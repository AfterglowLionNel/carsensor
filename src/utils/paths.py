from pathlib import Path


def get_scraped_dir(project_root: Path) -> Path:
    """Return the directory containing scraped data.

    If ``project_root/data/scraped`` exists, use it. Otherwise fall back to
    ``project_root/src/scraper/data/scraped``.
    """
    default = project_root / 'data' / 'scraped'
    if default.exists():
        return default
    return project_root / 'src' / 'scraper' / 'data' / 'scraped'
