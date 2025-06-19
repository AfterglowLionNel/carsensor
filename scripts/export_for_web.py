#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Web用データエクスポート
既存のCSV/Excelデータを Web Dashboard 用に変換
"""

import pandas as pd
import json
import os
import re
from pathlib import Path
from datetime import datetime
import logging

# ログ設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def find_latest_data():
    """最新のRC Fデータファイルを検索"""
    project_root = Path(__file__).parent.parent
    scraped_dir = project_root / 'data' / 'scraped' / 'F'
    
    if not scraped_dir.exists():
        logger.error(f"データディレクトリが存在しません: {scraped_dir}")
        return None
    
    all_files = []
    
    # 日付ディレクトリから全CSVファイルを検索
    for date_dir in scraped_dir.iterdir():
        if date_dir.is_dir():
            csv_files = list(date_dir.glob('*.csv'))
            all_files.extend(csv_files)
    
    if not all_files:
        logger.warning("CSVファイルが見つかりません")
        return None
    
    # ファイル名からNo番号を抽出してソート（最新を取得）
    def get_file_number(file_path):
        match = re.search(r'\.No(\d+)\.csv$', file_path.name)
        return int(match.group(1)) if match else 0
    
    latest_file = max(all_files, key=lambda f: (f.stat().st_mtime, get_file_number(f)))
    logger.info(f"最新ファイル: {latest_file}")
    
    return latest_file

def clean_and_validate_data(df):
    """データのクリーニングと検証"""
    logger.info(f"データクリーニング開始: {len(df)}件")
    
    # 必要な列の存在チェック
    required_columns = ['車種名', 'グレード', '支払総額', '年式', '走行距離']
    missing_columns = [col for col in required_columns if col not in df.columns]
    
    if missing_columns:
        logger.warning(f"欠損列: {missing_columns}")
    
    # データ型の統一
    cleaned_df = df.copy()
    
    # 価格の統一（"万円"を含む文字列から数値を抽出）
    def extract_price(price_str):
        if pd.isna(price_str):
            return None
        match = re.search(r'([0-9.]+)万円', str(price_str))
        return float(match.group(1)) if match else None
    
    # 年式の統一（YYYY年形式から数値を抽出）
    def extract_year(year_str):
        if pd.isna(year_str):
            return None
        match = re.search(r'(\d{4})', str(year_str))
        return int(match.group(1)) if match else None
    
    # 走行距離の統一（"万km"から数値を抽出）
    def extract_mileage(mileage_str):
        if pd.isna(mileage_str):
            return None
        if '万km' in str(mileage_str):
            match = re.search(r'([0-9.]+)万km', str(mileage_str))
            return float(match.group(1)) * 10000 if match else None
        elif 'km' in str(mileage_str):
            match = re.search(r'([0-9.]+)km', str(mileage_str))
            return float(match.group(1)) if match else None
        return None
    
    # データ処理
    cleaned_df['価格数値'] = cleaned_df['支払総額'].apply(extract_price)
    cleaned_df['年式数値'] = cleaned_df['年式'].apply(extract_year)
    cleaned_df['走行距離数値'] = cleaned_df['走行距離'].apply(extract_mileage)
    
    # 無効なデータを除外
    before_count = len(cleaned_df)
    cleaned_df = cleaned_df.dropna(subset=['価格数値', '年式数値', '走行距離数値'])
    after_count = len(cleaned_df)
    
    logger.info(f"データクリーニング完了: {after_count}件 ({before_count - after_count}件除外)")
    
    return cleaned_df

def enhance_data_for_web(df):
    """Web表示用のデータ拡張"""
    enhanced_df = df.copy()
    
    # 正規グレードが存在しない場合は元グレードをコピー
    if '正規グレード' not in enhanced_df.columns:
        enhanced_df['正規グレード'] = enhanced_df['グレード']
    else:
        enhanced_df['正規グレード'] = enhanced_df['正規グレード'].fillna(enhanced_df['グレード'])
    
    # マッチング精度のデフォルト値
    if 'マッチング精度' not in enhanced_df.columns:
        enhanced_df['マッチング精度'] = 0.8
    
    # 修復歴のデフォルト値
    if '修復歴' not in enhanced_df.columns:
        enhanced_df['修復歴'] = 'なし'
    else:
        enhanced_df['修復歴'] = enhanced_df['修復歴'].fillna('なし')
    
    # ミッションのデフォルト値
    if 'ミッション' not in enhanced_df.columns:
        enhanced_df['ミッション'] = 'フロアMTモード付8AT'
    
    # 排気量のデフォルト値
    if '排気量' not in enhanced_df.columns:
        enhanced_df['排気量'] = '5000CC'
    
    # 取得日時の処理
    if '取得日時' in enhanced_df.columns:
        enhanced_df['取得日時'] = enhanced_df['取得日時'].fillna('')
    else:
        enhanced_df['取得日時'] = ''
    
    # ソースURLの処理
    if 'ソースURL' not in enhanced_df.columns:
        enhanced_df['ソースURL'] = ''

    # 車両URLの処理
    if '車両URL' not in enhanced_df.columns:
        enhanced_df['車両URL'] = enhanced_df.get('ソースURL', '')
    
    # 追加の分析用カラム
    enhanced_df['年齢'] = datetime.now().year - enhanced_df['年式数値']
    enhanced_df['年間走行距離'] = enhanced_df['走行距離数値'] / enhanced_df['年齢'].clip(lower=1)
    enhanced_df['価格万円あたりCC'] = enhanced_df['価格数値'] * 10000 / 5000  # RC Fは5000CC固定
    
    # グレード正規化の簡易版
    def normalize_grade_simple(grade):
        if pd.isna(grade):
            return 'ベース'
        
        grade_str = str(grade)
        
        # RC Fの特殊パターン
        patterns = [
            ('カーボンエクステリアパッケージ', 'カーボンエクステリア'),
            ('パフォーマンスパッケージ', 'パフォーマンス'),
            ('F 10th アニバーサリー', '10th アニバーサリー'),
            ('ファイナル エディション', 'ファイナル エディション'),
            ('エモーショナル ツーリング', 'エモーショナル ツーリング'),
            ('5.0', '5.0')
        ]
        
        for pattern, normalized in patterns:
            if pattern in grade_str:
                return normalized
        
        # デフォルト処理
        cleaned = re.sub(r'^RC\s+', '', grade_str)
        cleaned = re.sub(r'[（）\(\)\[\]【】]', '', cleaned)
        return cleaned.strip() or 'ベース'
    
    # 正規グレードが空の場合の処理
    mask = enhanced_df['正規グレード'].isna() | (enhanced_df['正規グレード'] == '')
    enhanced_df.loc[mask, '正規グレード'] = enhanced_df.loc[mask, 'グレード'].apply(normalize_grade_simple)
    
    logger.info(f"データ拡張完了: {len(enhanced_df)}件")
    
    return enhanced_df

def export_to_json(df, output_path):
    """JSONファイルとしてエクスポート"""
    try:
        # Web用に最適化したデータ構造
        web_data = []
        
        for _, row in df.iterrows():
            record = {
                '車種名': row.get('車種名', 'F'),
                'モデル': row.get('モデル', '情報なし'),
                'グレード': row.get('グレード', ''),
                '正規グレード': row.get('正規グレード', ''),
                '支払総額': row.get('支払総額', ''),
                '年式': row.get('年式', ''),
                '走行距離': row.get('走行距離', ''),
                '修復歴': row.get('修復歴', 'なし'),
                'ミッション': row.get('ミッション', ''),
                '排気量': row.get('排気量', '5000CC'),
                'マッチング精度': float(row.get('マッチング精度', 0.8)),
                '取得日時': row.get('取得日時', ''),
                'ソースURL': row.get('ソースURL', ''),
                '車両URL': row.get('車両URL', row.get('ソースURL', '')),
                # 分析用の数値データ
                'price': float(row.get('価格数値', 0)),
                'year': int(row.get('年式数値', 2020)),
                'mileage': float(row.get('走行距離数値', 0)),
                'age': int(row.get('年齢', 1)),
                'mileagePerYear': float(row.get('年間走行距離', 0))
            }
            web_data.append(record)
        
        # JSONファイル保存
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(web_data, f, ensure_ascii=False, indent=2)
        
        logger.info(f"JSONエクスポート完了: {output_path}")
        logger.info(f"レコード数: {len(web_data)}")
        
        return True
        
    except Exception as e:
        logger.error(f"JSONエクスポートエラー: {e}")
        return False

def export_metadata(df, output_dir):
    """メタデータファイルの生成"""
    try:
        metadata = {
            'export_date': datetime.now().isoformat(),
            'total_records': len(df),
            'unique_grades': int(df['正規グレード'].nunique()),
            'year_range': {
                'min': int(df['年式数値'].min()),
                'max': int(df['年式数値'].max())
            },
            'price_range': {
                'min': float(df['価格数値'].min()),
                'max': float(df['価格数値'].max()),
                'avg': float(df['価格数値'].mean())
            },
            'mileage_range': {
                'min': float(df['走行距離数値'].min()),
                'max': float(df['走行距離数値'].max()),
                'avg': float(df['走行距離数値'].mean())
            },
            'grade_distribution': df['正規グレード'].value_counts().to_dict(),
            'data_quality': {
                'complete_records': len(df),
                'missing_data_rate': float(df.isnull().sum().sum() / (len(df) * len(df.columns)))
            }
        }
        
        metadata_path = output_dir / 'metadata.json'
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
        
        logger.info(f"メタデータ保存完了: {metadata_path}")
        
    except Exception as e:
        logger.error(f"メタデータ生成エラー: {e}")

def main():
    """メイン処理"""
    logger.info("Web用データエクスポート開始")
    
    # プロジェクトルート設定
    project_root = Path(__file__).parent.parent
    output_dir = project_root / 'web-dashboard' / 'public' / 'data'
    
    # 出力ディレクトリ作成
    output_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        # 最新データファイルを検索
        latest_file = find_latest_data()
        if not latest_file:
            logger.error("データファイルが見つかりません")
            return False
        
        # CSVデータ読み込み
        logger.info(f"データ読み込み: {latest_file}")
        df = pd.read_csv(latest_file, encoding='utf-8-sig')
        
        # データクリーニング
        cleaned_df = clean_and_validate_data(df)
        
        if len(cleaned_df) == 0:
            logger.error("有効なデータがありません")
            return False
        
        # Web用データ拡張
        enhanced_df = enhance_data_for_web(cleaned_df)
        
        # JSONエクスポート
        json_output_path = output_dir / 'rc_f_data.json'
        if not export_to_json(enhanced_df, json_output_path):
            return False
        
        # メタデータ生成
        export_metadata(enhanced_df, output_dir)
        
        # サマリー情報の表示
        logger.info("=" * 50)
        logger.info("エクスポート完了サマリー")
        logger.info("=" * 50)
        logger.info(f"ソースファイル: {latest_file.name}")
        logger.info(f"出力ファイル: {json_output_path}")
        logger.info(f"総レコード数: {len(enhanced_df)}")
        logger.info(f"グレード数: {enhanced_df['正規グレード'].nunique()}")
        logger.info(f"年式範囲: {enhanced_df['年式数値'].min()}-{enhanced_df['年式数値'].max()}")
        logger.info(f"価格範囲: {enhanced_df['価格数値'].min():.1f}-{enhanced_df['価格数値'].max():.1f}万円")
        
        # グレード分布Top5
        grade_counts = enhanced_df['正規グレード'].value_counts().head(5)
        logger.info("主要グレード分布:")
        for grade, count in grade_counts.items():
            logger.info(f"  {grade}: {count}件")
        
        return True
        
    except Exception as e:
        logger.error(f"エクスポート処理でエラーが発生しました: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    success = main()
    if success:
        print("\n✅ Web用データエクスポートが完了しました!")
        print("次のコマンドでWebダッシュボードを起動できます:")
        print("cd web-dashboard && npm start")
    else:
        print("\n❌ エクスポート処理が失敗しました。ログを確認してください。")
        exit(1)