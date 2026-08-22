from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML
from io import BytesIO
from uuid import UUID
from app import models, scheme
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import datetime
from app.crud import crud_stmt_scenario
from app.plugins.registry_singleton import registry


def make_pdf(html: str) -> bytes:
    return HTML(string=html, base_url=".").write_pdf()


class ScenarioPDFExporter:
    def __init__(self, template_dir: str = "templates/pdf"):
        self.env = Environment(loader=FileSystemLoader(template_dir))

        def flatten(seq):
            for sub in seq:
                if not sub:
                    continue
                for x in sub:
                    yield x
        self.env.filters['flatten'] = flatten

    def _get_factory(self, scenario):
        rule_id = getattr(scenario, "rule_id_str", None)
        if not rule_id:
            return None
        plugin = registry.get(rule_id)
        if not plugin:
            return None
        return plugin.get_factory()

    def _dump_html(self, factory, entity: str, obj) -> str:
        if not factory:
            return None
        try:
            # ORM-объект — берём поле data напрямую
            if hasattr(obj, "data"):
                raw_data = obj.data or {}
                payload = {"data": raw_data, "tags": getattr(obj, "tags", None) or []}
            elif isinstance(obj, dict):
                payload = obj
            else:
                return None

            result = factory.handle(
                kind="dump.html",
                entity=entity,
                payload=payload,
                context={},
            )
            return result if isinstance(result, str) else None
        except Exception as e:
            return None  # можно добавить logger.warning(e) для отладки


    async def export_scenario(
        self,
        db: AsyncSession,
        scenario_id: UUID,
        include_master_only: bool = True,
    ) -> BytesIO:
        scenario = await self._load_scenario(db, scenario_id)
        factory = self._get_factory(scenario)

        # ── локации ────────────────────────────────────────────────────────
        raw_tree = self._build_locations_hierarchy(scenario.locations)
        locations_tree = self._number_items(raw_tree)

        # ── персонажи ──────────────────────────────────────────────────────
        characters_ctx = []
        for ch in (scenario.characters or []):
            characters_ctx.append({
                "character": ch,
                "data_html": self._dump_html(factory, "character", ch),
            })

        # ── NPC ────────────────────────────────────────────────────────────
        npcs_ctx = []
        for npc in (scenario.npcs or []):
            npcs_ctx.append({
                "npc": npc,
                "data_html": self._dump_html(factory, "npc", npc),
            })

        # ── предметы ──────────────────────────────────────────────────────
        items_ctx = []
        for item in (scenario.items or []):
            items_ctx.append({
                "item": item,
                "data_html": self._dump_html(factory, "item", item),
            })

        # ── scene_exposures внутри локаций ────────────────────────────────
        # enrichим каждый exposure у локации
        def enrich_exposures(scene_exposures):
            result = []
            for se in (scene_exposures or []):
                npcs_se = [
                    {"npc": npc, "data_html": self._dump_html(factory, "npc", npc), "is_template": False}
                    for npc in (se.npcs or [])
                ]
                npcs_se += [
                    {"npc": npc, "data_html": self._dump_html(factory, "npc", npc), "is_template": True}
                    for npc in (getattr(se, "template_npcs", None) or [])
                ]

                items_se = [
                    {"item": item, "data_html": self._dump_html(factory, "item", item), "is_template": False}
                    for item in (se.items or [])
                ]
                items_se += [
                    {"item": item, "data_html": self._dump_html(factory, "item", item), "is_template": True}
                    for item in (getattr(se, "template_items", None) or [])
                ]

                obstacles_se = [
                    {"obstacle": obs, "data_html": self._dump_html(factory, "obstacle", obs)}
                    for obs in (getattr(se, "obstacles", None) or [])
                ]

                result.append({
                    "exposure": se,
                    "exp_npcs": npcs_se,
                    "exp_items": items_se,
                    "exp_obstacles": obstacles_se,  # ← добавлено
                })
            return result




        def enrich_tree(nodes: list[dict]) -> list[dict]:
            enriched = []
            for node in nodes:
                enriched.append({
                    "number": node["number"],
                    "location": node["location"],
                    "exposures": enrich_exposures(node["location"].scene_exposures),
                    "children": enrich_tree(node["children"]),
                })
            return enriched

        locations_tree_enriched = enrich_tree(locations_tree)

        # ── story beats ───────────────────────────────────────────────────
        story_beats_ctx = []
        for sb in (scenario.story_beats or []):
            # прямые NPC через story_beat_npc
            sb_npcs = [
                {"npc": npc, "data_html": self._dump_html(factory, "npc", npc), "is_template": False}
                for npc in (getattr(sb, "npcs", None) or [])
            ]

            # экспозиции story beat
            sb_exposures = []
            for se in (getattr(sb, "scene_exposures", None) or []):
                npcs_se = [
                    {"npc": npc, "data_html": self._dump_html(factory, "npc", npc), "is_template": False}
                    for npc in (se.npcs or [])
                ]
                npcs_se += [
                    {"npc": npc, "data_html": self._dump_html(factory, "npc", npc), "is_template": True}
                    for npc in (getattr(se, "template_npcs", None) or [])
                ]

                items_se = [
                    {"item": item, "data_html": self._dump_html(factory, "item", item), "is_template": False}
                    for item in (se.items or [])
                ]
                items_se += [
                    {"item": item, "data_html": self._dump_html(factory, "item", item), "is_template": True}
                    for item in (getattr(se, "template_items", None) or [])
                ]

                sb_exposures.append({
                    "exposure": se,
                    "exp_npcs": npcs_se,
                    "exp_items": items_se,
                })

            story_beats_ctx.append({
                "beat": sb,
                "beat_npcs": sb_npcs,        # прямые NPC бита
                "exposures": enrich_exposures(getattr(sb, "scene_exposures", None)),
            })


        context = {
            "scenario": scenario,
            "locations_tree": locations_tree_enriched,
            "characters": characters_ctx,
            "npcs": npcs_ctx,
            "items": items_ctx,
            "story_beats": story_beats_ctx,
            "include_master_only": include_master_only,
            "generated_at": datetime.now().isoformat(),
        }

        template = self.env.get_template("scenario.html")
        html_content = template.render(context)
        pdf_bytes = HTML(string=html_content, base_url=".").write_pdf()
        return BytesIO(pdf_bytes)

    async def _load_scenario(self, db: AsyncSession, scenario_id: UUID):
        result = await db.execute(
            crud_stmt_scenario()
            .options(
                selectinload(models.Scenario.locations)
                    .selectinload(models.Location.scene_exposures)
                    .options(
                        selectinload(models.SceneExposure.npcs),
                        selectinload(models.SceneExposure.items),
                        selectinload(models.SceneExposure.obstacles),
                        selectinload(models.SceneExposure.template_npc_links)
                            .selectinload(models.SceneExposureTemplateNPC.template_npc),
                        selectinload(models.SceneExposure.template_item_links)
                            .selectinload(models.SceneExposureTemplateItem.template_item),
                    ),

                selectinload(models.Scenario.story_beats)
                    .options(
                        selectinload(models.StoryBeat.npcs),
                        selectinload(models.StoryBeat.scene_exposures)
                            .options(
                                selectinload(models.SceneExposure.npcs),
                                selectinload(models.SceneExposure.items),
                                selectinload(models.SceneExposure.obstacles),
                                selectinload(models.SceneExposure.template_npc_links)
                                    .selectinload(models.SceneExposureTemplateNPC.template_npc),
                                selectinload(models.SceneExposure.template_item_links)
                                    .selectinload(models.SceneExposureTemplateItem.template_item),
                            ),
                    ),

                # NPC сценария
                selectinload(models.Scenario.npcs),

                # предметы сценария
                selectinload(models.Scenario.items),

                # персонажи + их предметы
                selectinload(models.Scenario.characters)
                    .selectinload(models.PlayerCharacter.owned_item_links),

                # заметки, счётчики
                selectinload(models.Scenario.notes),
                selectinload(models.Scenario.counters),

                # автор
                selectinload(models.Scenario.user),
            )
            .where(models.Scenario.id == scenario_id)
        )
        scenario = result.scalars().first()
        if not scenario:
            raise ValueError(f"Scenario {scenario_id} not found")
        return scenario

    def _build_locations_hierarchy(self, locations: list) -> list[dict]:
        nodes = {loc.id: {"location": loc, "children": []} for loc in locations}
        roots: list[dict] = []
        for loc in locations:
            node = nodes[loc.id]
            if loc.parent_location_id is None:
                roots.append(node)
            else:
                parent = nodes.get(loc.parent_location_id)
                if parent:
                    parent["children"].append(node)
                else:
                    roots.append(node)
        return roots

    def _number_items(self, roots: list[dict], prefix: str = "") -> list[dict]:
        numbered = []
        for idx, node in enumerate(roots, 1):
            number = f"{prefix}{idx}" if prefix else str(idx)
            numbered.append({
                "number": number,
                "location": node["location"],
                "children": self._number_items(node["children"], f"{number}."),
            })
        return numbered
