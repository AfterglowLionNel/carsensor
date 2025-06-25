#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
統合中古車分析システム - メインスクリプト
スクレイピングから分析まで一括処理
"""

import sys
import os
import re
import argparse
import pandas as pd
import logging
from pathlib import Path
from datetime import datetime

# プロジェクトルートをパスに追加
project_root = Path(__file__).parent.parent
sys.path.append(str(project_root))

from src.scraper.car_scraper import CarScraper
from src.analyzer.grade_normalizer import GradeNormalizer
from src.utils import get_car_directories

class CarAnalysisSystem:
    def __init__(self):
        self.project_root = project_root
        self.setup_logging()

    def available_car_dirs(self):
        """Return available car directory tuples ``(name, path)``."""
        return get_car_directories(self.project_root)
        
    def setup_logging(self):
        """ログ設定"""
        log_dir = self.project_root / 'logs'
        log_dir.mkdir(exist_ok=True)
        
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_dir / 'system.log', encoding='utf-8'),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
    
    def scrape_data(self):
        """データスクレイピング"""
        self.logger.info("スクレイピング開始")
        scraper = CarScraper()
        results = scraper.run_from_urls_file(str(self.project_root / 'urls.txt'))
        
        if results:
            self.logger.info(f"スクレイピング完了: {len(results)}ファイル")
            return results
        else:
            self.logger.warning("スクレイピングでデータが取得できませんでした")
            return []
    
    def analyze_data(self, data_path=None, car_name=None, car_dir=None, use_latest=False):
        """データ分析"""
        # 分析対象ファイルの特定
        if data_path:
            target_file = Path(data_path)
        elif car_dir:
            target_file = self.find_car_data_in_dir(Path(car_dir), use_latest)
        elif car_name:
            target_file = self.find_car_data_file(car_name, use_latest)
        else:
            target_file = self.select_data_file_interactive()
        
        if not target_file or not target_file.exists():
            self.logger.error(f"分析対象ファイルが見つかりません: {target_file}")
            return None
        
        self.logger.info(f"分析開始: {target_file}")
        
        try:
            # データ読み込み
            if target_file.suffix.lower() == '.csv':
                df = pd.read_csv(target_file, encoding='utf-8-sig')
            elif target_file.suffix.lower() in ['.xlsx', '.xls']:
                df = pd.read_excel(target_file)
            else:
                raise ValueError(f"サポートされていないファイル形式: {target_file.suffix}")
            
            self.logger.info(f"データ読み込み完了: {len(df)}件")
            
            # グレード正規化
            normalizer = GradeNormalizer()
            normalized_df = normalizer.normalize_dataframe(df)
            
            # 分析結果保存
            output_path = self.save_analysis_result(normalized_df, target_file)
            
            # レポート生成
            report = normalizer.get_normalization_report(normalized_df)
            self.print_analysis_report(report, target_file)
            
            self.logger.info(f"分析完了: {output_path}")
            return output_path
            
        except Exception as e:
            self.logger.error(f"分析エラー: {e}")
            return None
    
    def find_car_data_file(self, car_name, use_latest=True):
        """車種データファイル検索"""
        from src.utils import get_scraped_dir
        scraped_dir = get_scraped_dir(self.project_root)
        car_dirs = list(scraped_dir.glob(f"*{car_name}*"))
        
        if not car_dirs:
            self.logger.error(f"車種データが見つかりません: {car_name}")
            return None
        
        # 最新のデータディレクトリを検索
        all_files = []
        for car_dir in car_dirs:
            for date_dir in car_dir.iterdir():
                if date_dir.is_dir():
                    csv_files = list(date_dir.glob('*.csv'))
                    all_files.extend(csv_files)
        
        if not all_files:
            return None
        
        if use_latest:
            # 最新ファイルを返す
            return max(all_files, key=lambda f: f.stat().st_mtime)
        else:
            # 選択肢を表示
            return self.select_from_files(all_files)

    def find_car_data_in_dir(self, car_dir: Path, use_latest=True):
        """Search a directory for car data files."""
        if not car_dir.exists():
            self.logger.error(f"ディレクトリが見つかりません: {car_dir}")
            return None

        all_files = []
        for date_dir in car_dir.iterdir():
            if date_dir.is_dir():
                csv_files = list(date_dir.glob('*.csv'))
                all_files.extend(csv_files)

        if not all_files:
            self.logger.error(f"CSVファイルが見つかりません: {car_dir}")
            return None

        if use_latest:
            return max(all_files, key=lambda f: f.stat().st_mtime)
        else:
            return self.select_from_files(all_files)
    
    def select_from_files(self, files):
        """ファイル選択"""
        if not files:
            return None
        
        print(f"\n利用可能なファイル:")
        for i, file_path in enumerate(files, 1):
            print(f"{i}. {file_path.name} ({file_path.parent.name})")
        
        try:
            choice = int(input("ファイルを選択 (番号): "))
            if 1 <= choice <= len(files):
                return files[choice - 1]
        except ValueError:
            pass
        
        print("無効な選択です")
        return None
    
    def select_data_file_interactive(self):
        """インタラクティブファイル選択"""
        from src.utils import get_scraped_dir
        scraped_dir = get_scraped_dir(self.project_root)
        
        if not scraped_dir.exists():
            print("スクレイピングデータが見つかりません")
            return None
        
        # 車種ディレクトリ一覧
        car_dirs = [d for d in scraped_dir.iterdir() if d.is_dir()]
        
        if not car_dirs:
            print("車種データが見つかりません")
            return None
        
        print("\n利用可能な車種:")
        for i, car_dir in enumerate(car_dirs, 1):
            print(f"{i}. {car_dir.name}")
        
        try:
            choice = int(input("車種を選択 (番号): "))
            if 1 <= choice <= len(car_dirs):
                selected_car = car_dirs[choice - 1]
                
                # 該当車種のファイル一覧
                all_files = []
                for date_dir in selected_car.iterdir():
                    if date_dir.is_dir():
                        csv_files = list(date_dir.glob('*.csv'))
                        all_files.extend(csv_files)
                
                return self.select_from_files(all_files)
                
        except ValueError:
            pass
        
        print("無効な選択です")
        return None
    
    def save_analysis_result(self, df, source_file):
        """分析結果保存"""
        # 出力ディレクトリ
        output_dir = self.project_root / 'data' / 'normalized'
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # ファイル名生成
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        car_name = df['車種名'].iloc[0] if '車種名' in df.columns else 'Unknown'
        output_filename = f"{car_name}_normalized_{timestamp}.xlsx"
        output_path = output_dir / output_filename
        
        # Excel保存（複数シート）
        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # 正規化済みデータ
            df.to_excel(writer, sheet_name='正規化済みデータ', index=False)
            
            # グレード別集計
            if '正規グレード' in df.columns:
                grade_summary = df.groupby('正規グレード').agg({
                    '支払総額': lambda x: self.extract_price_stats(x),
                    'マッチング精度': 'mean'
                }).round(2)
                grade_summary.to_excel(writer, sheet_name='グレード別集計')
            
            # メタデータ
            metadata = {
                'ソースファイル': str(source_file),
                '処理日時': datetime.now().isoformat(),
                '総件数': len(df),
                '正規グレード数': df['正規グレード'].nunique() if '正規グレード' in df.columns else 0
            }
            metadata_df = pd.DataFrame([metadata])
            metadata_df.to_excel(writer, sheet_name='メタデータ', index=False)
        
        return output_path
    
    def extract_price_stats(self, price_series):
        """価格統計計算"""
        values = []
        for price in price_series:
            if pd.isna(price):
                continue
            match = re.search(r'([0-9.]+)万円', str(price))
            if match:
                values.append(float(match.group(1)))
        
        if values:
            import numpy as np
            return {
                '平均': np.mean(values),
                '最小': np.min(values),
                '最大': np.max(values),
                '件数': len(values)
            }
        return {'平均': 0, '最小': 0, '最大': 0, '件数': 0}
    
    def print_analysis_report(self, report, source_file):
        """分析レポート表示"""
        print("\n" + "=" * 60)
        print("📊 分析レポート")
        print("=" * 60)
        print(f"ソースファイル: {source_file.name}")
        print(f"処理日時: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        if report:
            print(f"\n📈 基本統計:")
            print(f"  総データ数: {report['total_count']:,}件")
            print(f"  元グレード数: {report['unique_original_grades']}種類")
            print(f"  正規グレード数: {report['unique_normalized_grades']}種類")
            
            quality = report.get('matching_quality', {})
            print(f"\n🎯 マッチング精度:")
            print(f"  高精度(≥80%): {quality.get('high_confidence', 0)}件")
            print(f"  中精度(60-80%): {quality.get('medium_confidence', 0)}件")
            print(f"  低精度(<60%): {quality.get('low_confidence', 0)}件")
            
            print(f"\n📋 グレード別データ数(上位5件):")
            grade_dist = report.get('grade_distribution', {})
            for grade, count in list(grade_dist.items())[:5]:
                print(f"  {grade}: {count}件")
    
    def list_available_data(self):
        """利用可能データ一覧表示"""
        from src.utils import get_scraped_dir
        scraped_dir = get_scraped_dir(self.project_root)
        
        if not scraped_dir.exists():
            print("スクレイピングデータが見つかりません")
            return
        
        print("📁 利用可能なデータ:")
        print("-" * 50)
        
        for car_dir in scraped_dir.iterdir():
            if car_dir.is_dir():
                print(f"\n🚗 {car_dir.name}")
                
                for date_dir in car_dir.iterdir():
                    if date_dir.is_dir():
                        csv_files = list(date_dir.glob('*.csv'))
                        for csv_file in csv_files:
                            # ファイルサイズ取得
                            size_mb = csv_file.stat().st_size / (1024 * 1024)
                            print(f"  📄 {csv_file.name} ({size_mb:.1f}MB)")
    
    def interactive_mode(self):
        """インタラクティブモード"""
        print("🚗 統合中古車分析システム")
        print("=" * 50)
        
        while True:
            print("\n選択してください:")
            print("1. データスクレイピング")
            print("2. データ分析")
            print("3. 利用可能データ一覧")
            print("4. 全工程実行")
            print("5. 終了")
            
            choice = input("\n選択 (1-5): ").strip()
            
            if choice == '1':
                self.scrape_data()
            elif choice == '2':
                self.analyze_data()
            elif choice == '3':
                self.list_available_data()
            elif choice == '4':
                scraped_files = self.scrape_data()
                for file_path in scraped_files:
                    self.analyze_data(data_path=file_path)
            elif choice == '5':
                print("システムを終了します")
                break
            else:
                print("無効な選択です")

def main():
    """メイン関数"""
    car_dirs = get_car_directories(project_root)
    epilog = ""
    if car_dirs:
        lines = ["利用可能な車種ディレクトリ:"]
        for name, path in car_dirs:
            lines.append(f"  {name}: {path}")
        epilog = "\n".join(lines)

    parser = argparse.ArgumentParser(description='統合中古車分析システム', epilog=epilog)
    parser.add_argument('--scrape', action='store_true', help='スクレイピング実行')
    parser.add_argument('--analyze', action='store_true', help='分析実行')
    parser.add_argument('--all', action='store_true', help='全工程実行')
    parser.add_argument('--interactive', action='store_true', help='インタラクティブモード')
    
    parser.add_argument('--path', help='分析対象ファイルパス')
    parser.add_argument('--car', help='車種名')
    parser.add_argument('--dir', help='車種データディレクトリパス')
    parser.add_argument('--latest', action='store_true', help='最新データ使用')
    parser.add_argument('--list', action='store_true', help='利用可能データ一覧')
    
    args = parser.parse_args()
    
    system = CarAnalysisSystem()
    
    try:
        if args.interactive:
            system.interactive_mode()
        elif args.all:
            print("🚀 全工程を実行します")
            scraped_files = system.scrape_data()
            for file_path in scraped_files:
                system.analyze_data(data_path=file_path)
        elif args.scrape:
            system.scrape_data()
        elif args.analyze:
            system.analyze_data(
                data_path=args.path,
                car_name=args.car,
                car_dir=args.dir,
                use_latest=args.latest
            )
        elif args.list:
            system.list_available_data()
        else:
            parser.print_help()
            
    except KeyboardInterrupt:
        print("\n🛑 処理を中断しました")
    except Exception as e:
        print(f"❌ エラーが発生しました: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
