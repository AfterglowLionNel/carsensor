import os
import sys
import types
from pathlib import Path

# Provide minimal pandas stub if pandas is not installed
if 'pandas' not in sys.modules:
    sys.modules['pandas'] = types.ModuleType('pandas')

# Provide minimal requests stub if requests is not installed
if 'requests' not in sys.modules:
    requests_stub = types.ModuleType('requests')
    class _Session:
        def __init__(self):
            self.headers = {}
        def get(self, *a, **k):
            class _Resp:
                status_code = 200
                text = ''
                def raise_for_status(self):
                    pass
            return _Resp()
    requests_stub.Session = _Session
    sys.modules['requests'] = requests_stub

if 'bs4' not in sys.modules:
    bs4_stub = types.ModuleType('bs4')
    bs4_stub.BeautifulSoup = object
    sys.modules['bs4'] = bs4_stub

from src.analyzer.grade_normalizer import GradeNormalizer
from src.scraper.car_scraper import CarScraper


def test_grade_normalizer_load():
    gn = GradeNormalizer()
    assert gn.grades_json_path == Path('config') / 'car_grades.json'
    assert gn.grades_json_path.exists()
    # car_grades_db should not be empty when config is present
    assert len(gn.car_grades_db) > 0
    assert isinstance(gn.exclude_keywords, list)


def test_car_scraper_output_dir(tmp_path):
    # use temporary directory to avoid polluting repository
    scraper = CarScraper(output_dir=tmp_path)
    assert scraper.output_dir == tmp_path
    assert scraper.output_dir.exists()

from src.utils import get_scraped_dir


def test_get_scraped_dir(tmp_path):
    project_root = tmp_path
    fallback = project_root / 'src' / 'scraper' / 'data' / 'scraped'
    fallback.mkdir(parents=True)
    assert get_scraped_dir(project_root) == fallback

    default = project_root / 'data' / 'scraped'
    default.mkdir(parents=True)
    assert get_scraped_dir(project_root) == default
