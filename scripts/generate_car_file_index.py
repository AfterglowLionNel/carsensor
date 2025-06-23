import json
from pathlib import Path
import shutil

DATA_ROOT = Path(__file__).resolve().parent.parent / 'src' / 'scraper' / 'data' / 'scraped'
OUTPUT_DIR = Path(__file__).resolve().parent.parent / 'web-dashboard' / 'public' / 'data'


def collect_files():
    index = {}
    if not DATA_ROOT.exists():
        return index
    for car_dir in sorted([p for p in DATA_ROOT.iterdir() if p.is_dir()]):
        car_name = car_dir.name
        files = []
        for date_dir in sorted(car_dir.glob('*')):
            if not date_dir.is_dir():
                continue
            for csv in sorted(date_dir.glob('*.csv')):
                rel_path = Path('scraped') / car_name / date_dir.name / csv.name
                display = f"{date_dir.name} - {csv.name}"
                files.append({"path": str(rel_path), "displayName": display})
                dest = OUTPUT_DIR / rel_path
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy(csv, dest)
        if files:
            index[car_name] = files
    return index


def main():
    index = collect_files()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_DIR / 'car_file_index.json', 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, indent=2)


if __name__ == '__main__':
    main()
