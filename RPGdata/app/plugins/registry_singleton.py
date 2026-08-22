from pathlib import Path
from app.plugins.dir_loader import DirPluginRegistry

registry = DirPluginRegistry(plugins_dir=Path("/app/plugins"))
registry.load_all()
