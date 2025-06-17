#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
統合カーセンサースクレイパー
Windows環境対応・エラー処理強化版
"""

import requests
from bs4 import BeautifulSoup
import pandas as pd
import time
import os
import re
import logging
from datetime import datetime
from urllib.parse import urljoin
from pathlib import Path

class CarScraper:
    def __init__(self, output_dir="data\\scraped"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.setup_logging()
        
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
        })
        
    def setup_logging(self):
        log_dir = Path("logs")
        log_dir.mkdir(exist_ok=True)
        
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_dir / 'scraper.log', encoding='utf-8'),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
    
    def sanitize_filename(self, name):
        """ファイル名として使えない文字を置換・削除"""
        name = name.replace('・', '_').replace(' ', '_')
        return re.sub(r'[\\|/|:|*|?|"|<|>|\|]', '', name)
    
    def extract_car_name(self, soup, url):
        """車種名を抽出"""
        selectors = [
            ('h2.title1', r'(.+?)（全国）の中古車'),
            ('h1', r'(.+?)\s*の中古車'),
            ('title', r'(.+?)\s*の中古車')
        ]
        
        for selector, pattern in selectors:
            element = soup.select_one(selector)
            if element:
                match = re.search(pattern, element.get_text())
                if match:
                    full_name = match.group(1).strip()
                    return full_name.split()[-1].split('・')[-1]
        
        self.logger.warning(f"車種名を特定できませんでした: {url}")
        return "Unknown"
    
    def parse_car_item(self, item, car_name):
        """個別車両アイテムの解析"""
        try:
            # タイトル・グレード
            title_tag = item.find('h3', class_='cassetteMain__title')
            full_title = title_tag.get_text(strip=True) if title_tag else '情報なし'
            grade = full_title.replace(car_name, '', 1).strip()
            
            # モデル情報
            model_tag = item.find('p', class_='cassetteMain__tag')
            model_info = model_tag.get_text(strip=True) if model_tag else '情報なし'
            
            # 価格
            price_tag = item.find('div', class_='totalPrice')
            if price_tag and price_tag.find('p', class_='totalPrice__content'):
                price = price_tag.find('p', class_='totalPrice__content').get_text(strip=True)
            else:
                price = '応談'
            
            # 仕様情報
            spec_data = {
                '年式': '情報なし',
                '走行距離': '情報なし', 
                '修復歴': '情報なし',
                'ミッション': '情報なし',
                '排気量': '情報なし'
            }
            
            spec_items = item.select('dl.specList > div.specList__detailBox')
            for spec_item in spec_items:
                dt = spec_item.find('dt')
                dd = spec_item.find('dd')
                if dt and dd:
                    label = dt.get_text(strip=True)
                    value = dd.get_text(strip=True)
                    if label in spec_data:
                        spec_data[label] = value
            
            return {
                '車種名': car_name,
                'モデル': model_info,
                'グレード': grade,
                '支払総額': price,
                '年式': spec_data['年式'],
                '走行距離': spec_data['走行距離'],
                '修復歴': spec_data['修復歴'],
                'ミッション': spec_data['ミッション'],
                '排気量': spec_data['排気量'],
                '取得日時': datetime.now().isoformat(),
                'ソースURL': ''  # 後で設定
            }
            
        except Exception as e:
            self.logger.warning(f"車両アイテム解析エラー: {e}")
            return None
    
    def scrape_url(self, url, max_pages=10, max_items_per_page=30):
        """単一URLのスクレイピング"""
        self.logger.info(f"スクレイピング開始: {url}")
        
        car_data_list = []
        current_url = url
        page_count = 1
        car_name = None
        
        while current_url and page_count <= max_pages:
            try:
                self.logger.info(f"ページ {page_count} を処理中...")
                
                response = self.session.get(current_url, timeout=10)
                response.raise_for_status()
                response.encoding = response.apparent_encoding
                soup = BeautifulSoup(response.text, 'html.parser')
                
                # 1ページ目で車種名を取得
                if page_count == 1:
                    car_name = self.extract_car_name(soup, url)
                    self.logger.info(f"車種名: {car_name}")
                
                # 車両アイテムを取得
                car_items = soup.find_all('div', class_='cassette js_listTableCassette')
                if not car_items:
                    self.logger.warning("車両情報が見つかりませんでした")
                    break
                
                # 処理件数制限
                items_to_process = car_items[:max_items_per_page]
                self.logger.info(f"{len(car_items)}台中 {len(items_to_process)}台を処理")
                
                for item in items_to_process:
                    car_data = self.parse_car_item(item, car_name)
                    if car_data:
                        car_data['ソースURL'] = current_url
                        car_data_list.append(car_data)
                
                # 次ページURL取得
                next_button = soup.select_one('button.pager__btn__next:not([disabled])')
                if next_button and next_button.has_attr('onclick'):
                    match = re.search(r"location\.href='([^']*)'", next_button['onclick'])
                    if match:
                        current_url = urljoin(current_url, match.group(1))
                        page_count += 1
                        time.sleep(1)
                    else:
                        break
                else:
                    break
                    
            except requests.RequestException as e:
                self.logger.error(f"リクエストエラー: {e}")
                break
            except Exception as e:
                self.logger.error(f"予期せぬエラー: {e}")
                break
        
        self.logger.info(f"スクレイピング完了: {len(car_data_list)}台")
        return car_data_list, car_name
    
    def save_data(self, car_data_list, car_name):
        """データ保存"""
        if not car_data_list:
            self.logger.warning("保存するデータがありません")
            return None
        
        # 保存先ディレクトリ
        today = datetime.now()
        car_folder = self.output_dir / self.sanitize_filename(car_name)
        date_folder = car_folder / today.strftime('%Y年%m月%d日')
        date_folder.mkdir(parents=True, exist_ok=True)
        
        # ファイル番号決定
        base_filename = f"{today.strftime('%Y_%m_%d')}_{self.sanitize_filename(car_name)}"
        file_number = 1
        while True:
            csv_path = date_folder / f"{base_filename}.No{file_number}.csv"
            if not csv_path.exists():
                break
            file_number += 1
        
        final_filename = f"{base_filename}.No{file_number}"
        
        # データフレーム作成・保存
        df = pd.DataFrame(car_data_list)
        
        # CSV保存
        csv_path = date_folder / f"{final_filename}.csv"
        df.to_csv(csv_path, index=False, encoding='utf-8-sig')
        self.logger.info(f"CSV保存: {csv_path}")
        
        # Excel保存
        try:
            excel_path = date_folder / f"{final_filename}.xlsx"
            df.to_excel(excel_path, index=False, engine='openpyxl')
            self.logger.info(f"Excel保存: {excel_path}")
        except ImportError:
            self.logger.warning("openpyxlがインストールされていません")
        
        return csv_path
    
    def run_from_urls_file(self, urls_file="urls.txt"):
        """URLファイルからスクレイピング実行"""
        if not os.path.exists(urls_file):
            self.logger.error(f"URLファイルが見つかりません: {urls_file}")
            return []
        
        with open(urls_file, 'r', encoding='utf-8') as f:
            urls = [line.strip() for line in f 
                   if line.strip() and not line.startswith('#')]
        
        if not urls:
            self.logger.error("有効なURLが見つかりません")
            return []
        
        self.logger.info(f"{len(urls)}件のURLを処理します")
        
        results = []
        for i, url in enumerate(urls):
            try:
                car_data_list, car_name = self.scrape_url(url)
                if car_data_list:
                    saved_path = self.save_data(car_data_list, car_name)
                    if saved_path:
                        results.append(saved_path)
                
                # 次URLまで待機
                if i < len(urls) - 1:
                    self.logger.info("次のURL処理まで5秒待機...")
                    time.sleep(5)
                    
            except Exception as e:
                self.logger.error(f"URL処理エラー {url}: {e}")
                continue
        
        self.logger.info(f"全処理完了: {len(results)}ファイル生成")
        return results

def main():
    """メイン実行関数"""
    scraper = CarScraper()
    results = scraper.run_from_urls_file()
    
    if results:
        print("\n✅ スクレイピング完了")
        for path in results:
            print(f"  📄 {path}")
    else:
        print("❌ データが取得できませんでした")

if __name__ == '__main__':
    main()