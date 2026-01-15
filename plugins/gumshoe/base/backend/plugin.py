from pydantic import BaseModel

class Character(BaseModel):
    name: str
    stability: int

class Item(BaseModel):
    name: str

class GumshoeFactory:
    system_id = "gumshoe"

    def make_character(self, *, level: int = 1, name: str | None = None) -> BaseModel:
        return Character(name=name or "Investigator", stability=8)

    def list_items(self) -> list[BaseModel]:
        return [Item(name="Notebook")]

class Plugin:
    plugin_id = "gumshoe.base"
    plugin_name = "GUMSHOE (base)"
    plugin_version = "0.1.0"
    parent_id = None

    def build_factory(self, parent_factory):
        return GumshoeFactory()

    def schemas(self):
        return {"Character": Character, "Item": Item}

    def describe(self):
        return {"id": self.plugin_id, "parent": self.parent_id, "name": self.plugin_name, "version": self.plugin_version}

def create_plugin():
    return Plugin()
