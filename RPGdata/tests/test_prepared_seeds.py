import asyncio

from app.services.prepared_seeds import (
    PreparedSeedError,
    consume_plan,
    context_already_rolled,
    fill_prepared_seeds,
    resolve_seed_stage,
    validate_seed_image,
)

PNG = "data:image/png;base64,aaaa"
PNG_B = "data:image/png;base64,bbbb"
PNG_C = "data:image/png;base64,cccc"


def test_image_must_be_png_data_url():
    assert validate_seed_image(PNG) == PNG
    try:
        validate_seed_image("https://example/seed.png")
    except PreparedSeedError:
        return
    raise AssertionError("non png data-url must be rejected")


def test_setup_stage_is_not_a_seed_stage():
    workflow = {"stageKey": "perform_move.pre_roll", "stageData": {"wizard": {"currentKey": "perform_move.declare"}}}
    assert resolve_seed_stage(workflow, {"_stageKey": "perform_move.roll"}) is None
    assert resolve_seed_stage({"stageKey": "perform_move.setup"}, {}) is None
    assert resolve_seed_stage({"stageKey": "common.free_dice_roll.declare"}, {}) is None
    assert resolve_seed_stage({"stageKey": "gumshoe.attack.setup"}, {}) is None


def test_roll_phase_and_damage_wizard_resolve():
    assert resolve_seed_stage({"stageKey": "perform_move.roll"}, {}) == "perform_move.roll"
    damage = {
        "stageKey": "perform_move.post_roll",
        "stageData": {"wizard": {"currentKey": "perform_move.damage_roll"}},
    }
    assert resolve_seed_stage(damage, {"_stageKey": "perform_move.damage_roll"}) == "perform_move.damage_roll"
    assert resolve_seed_stage(damage, {"_stageKey": "perform_move.change_manifest"}) is None


def test_fill_does_nothing_without_flag():
    data = {}

    async def claim(n):
        raise AssertionError("claim must not run")

    claimed = asyncio.run(
        fill_prepared_seeds(
            session_id="s",
            user_id="u",
            workflow={"stageKey": "perform_move.roll"},
            input_data=data,
            claim_fn=claim,
        )
    )
    assert claimed == []
    assert data == {}


def test_fill_ignores_setup_even_with_flag():
    data = {"usePreparedSeed": True, "_stageKey": "perform_move.roll"}
    calls = []

    async def claim(n):
        calls.append(n)
        return [PNG]

    claimed = asyncio.run(
        fill_prepared_seeds(
            session_id="s",
            user_id="u",
            workflow={"stageKey": "perform_move.setup"},
            input_data=data,
            claim_fn=claim,
        )
    )
    assert claimed == []
    assert calls == []
    assert "usePreparedSeed" not in data


def test_fill_single_roll_seed_and_skips_when_already_drawn():
    data = {"usePreparedSeed": True}
    stock = [PNG, PNG_B]

    async def claim(n):
        out = stock[:n]
        del stock[:n]
        return out

    claimed = asyncio.run(
        fill_prepared_seeds(
            session_id="s",
            user_id="u",
            workflow={"stageKey": "common.free_dice_roll.roll"},
            input_data=data,
            claim_fn=claim,
        )
    )
    assert claimed == [PNG]
    assert data["roll_seed"] == PNG
    assert stock == [PNG_B]

    drawn = {"usePreparedSeed": True, "canvas_seed": PNG_C}
    claimed = asyncio.run(
        fill_prepared_seeds(
            session_id="s",
            user_id="u",
            workflow={"stageKey": "gumshoe.attack.roll"},
            input_data=drawn,
            claim_fn=claim,
        )
    )
    assert claimed == []
    assert drawn["canvas_seed"] == PNG_C
    assert stock == [PNG_B]


def test_attack_damage_uses_damage_seed():
    data = {"usePreparedSeed": True}

    async def claim(n):
        return [PNG][:n]

    claimed = asyncio.run(
        fill_prepared_seeds(
            session_id="s",
            user_id="u",
            workflow={"stageKey": "gumshoe.attack.damage"},
            input_data=data,
            claim_fn=claim,
        )
    )
    assert claimed == [PNG]
    assert data["damage_seed"] == PNG


def test_initiative_fills_only_player_roll_op():
    stock = [PNG]

    async def claim(n):
        return stock[:n]

    npc = {"usePreparedSeed": True, "op": "roll_npcs"}
    claimed = asyncio.run(
        fill_prepared_seeds(
            session_id="s",
            user_id="u",
            workflow={"stageKey": "initiative.roll"},
            input_data=npc,
            claim_fn=claim,
        )
    )
    assert claimed == []
    assert "roll_seed" not in npc

    missing_op = {"usePreparedSeed": True}
    claimed = asyncio.run(
        fill_prepared_seeds(
            session_id="s",
            user_id="u",
            workflow={"stageKey": "initiative.roll"},
            input_data=missing_op,
            claim_fn=claim,
        )
    )
    assert claimed == []

    player = {"usePreparedSeed": True, "op": "roll"}
    claimed = asyncio.run(
        fill_prepared_seeds(
            session_id="s",
            user_id="u",
            workflow={"stageKey": "initiative.roll"},
            input_data=player,
            claim_fn=claim,
        )
    )
    assert claimed == [PNG]
    assert player["roll_seed"] == PNG


def test_damage_fills_only_committed_empty_claims():
    data = {
        "usePreparedSeed": True,
        "rollsById": {
            "a": {"committed": True, "roll_seed": "", "dice": []},
            "b": {"committed": True, "roll_seed": PNG_C, "dice": []},
            "c": {"committed": False, "roll_seed": "", "dice": []},
        },
    }
    workflow = {
        "stageKey": "perform_move.post_roll",
        "stageData": {"wizard": {"currentKey": "perform_move.damage_roll"}},
    }
    taken = []

    async def claim(n):
        images = [PNG, PNG_B][:n]
        taken.extend(images)
        return images

    claimed = asyncio.run(
        fill_prepared_seeds(
            session_id="s",
            user_id="u",
            workflow=workflow,
            input_data=data,
            claim_fn=claim,
        )
    )
    assert claimed == [PNG]
    assert data["rollsById"]["a"]["roll_seed"] == PNG
    assert data["rollsById"]["b"]["roll_seed"] == PNG_C
    assert data["rollsById"]["c"]["roll_seed"] == ""
    assert taken == [PNG]


def test_terrify_fills_empty_seed_slots_only():
    data = {"usePreparedSeed": True, "seeds": {"a": "", "b": PNG_C}, "spentStability": {"a": 1}}

    async def claim(n):
        return [PNG, PNG_B][:n]

    claimed = asyncio.run(
        fill_prepared_seeds(
            session_id="s",
            user_id="u",
            workflow={"stageKey": "gumshoe.terrify.roll"},
            input_data=data,
            claim_fn=claim,
        )
    )
    assert claimed == [PNG]
    assert data["seeds"] == {"a": PNG, "b": PNG_C}
    assert data["spentStability"] == {"a": 1}


def test_already_rolled_does_not_claim():
    data = {"usePreparedSeed": True}

    async def claim(n):
        raise AssertionError("already rolled")

    claimed = asyncio.run(
        fill_prepared_seeds(
            session_id="s",
            user_id="u",
            workflow={"stageKey": "perform_move.roll", "context": {"entry": {"roll": {"dice": [3, 4]}}}},
            input_data=data,
            claim_fn=claim,
        )
    )
    assert claimed == []
    assert context_already_rolled("john.action.canvas", {"context": {"entry": {"dice_results": [6]}}})


def test_consume_plan_counts_damage_slots():
    data = {"rollsById": {"a": {"committed": True, "roll_seed": ""}, "b": {"committed": True, "roll_seed": ""}}}
    needed, apply = consume_plan("perform_move.damage_roll", data)
    assert needed == 2
    assert apply([PNG]) == 1
    assert data["rollsById"]["a"]["roll_seed"] == PNG
    assert data["rollsById"]["b"]["roll_seed"] == ""
