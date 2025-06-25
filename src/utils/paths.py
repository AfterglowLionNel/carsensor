from pathlib import Path
from typing import List, Tuple


def get_scraped_dir(project_root: Path) -> Path:
    """Return the directory containing scraped data.

    If ``project_root/data/scraped`` exists, use it. Otherwise fall back to
    ``project_root/src/scraper/data/scraped``.
    """
    default = project_root / 'data' / 'scraped'
    if default.exists():
        return default
    return project_root / 'src' / 'scraper' / 'data' / 'scraped'


def get_car_directories(project_root: Path) -> List[Tuple[str, Path]]:
    """Return available car data directories as ``[(name, path), ...]``.

    ``name`` is the directory name and ``path`` is an absolute :class:`Path`.
    If the scraped directory does not exist, an empty list is returned.
    """
    scraped = get_scraped_dir(project_root)
    if not scraped.exists():
        return []

    dirs = [(d.name, d) for d in scraped.iterdir() if d.is_dir()]
    return sorted(dirs, key=lambda x: x[0])
