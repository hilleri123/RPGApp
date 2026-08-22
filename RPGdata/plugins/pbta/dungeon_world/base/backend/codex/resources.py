from __future__ import annotations
from plugins.pbta.base.backend.codex import PbtaResourcesCodex as PbtaResourcesCodexBase
from plugins.pbta.base.backend.types import ResourceSpec


class DwResourcesCodex(PbtaResourcesCodexBase):
    """
    Игровые ресурсы DW: только forward и ongoing.
    Hold / prepared_spell / прочее — legacy, не в кодексе.
    """

    def get_resource_specs(self) -> list[ResourceSpec]:
        return [
            ResourceSpec(
                id="forward",
                title="Forward",
                kind="bonus",
                max_amount=None,
                consume_on="roll",
                expires_after_scene=False,
                description="+X к следующему релевантному броску, после чего снимается.",
            ),
            ResourceSpec(
                id="ongoing",
                title="Ongoing",
                kind="bonus",
                max_amount=None,
                consume_on="manual",
                expires_after_scene=False,
                description="+X ко всем релевантным броскам, пока не снят вручную.",
            ),
        ]


# обратная совместимость
ResourcesCodex = DwResourcesCodex
