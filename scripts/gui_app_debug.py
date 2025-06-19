#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
デバッグ版GUI中古車分析システム
"""

import sys
import os
import re
import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext
import pandas as pd
import logging
from pathlib import Path
from datetime import datetime
import threading
import queue

print("=== デバッグ開始 ===")

# プロジェクトルートをパスに追加
project_root = Path(__file__).parent.parent
sys.path.append(str(project_root))

print(f"プロジェクトルート: {project_root}")
print(f"現在のディレクトリ: {Path.cwd()}")

try:
    print("モジュールインポート開始...")
    from src.scraper.car_scraper import CarScraper
    print("CarScraper インポート成功")
    from src.analyzer.grade_normalizer import GradeNormalizer
    print("GradeNormalizer インポート成功")
except ImportError as e:
    print(f"モジュールインポートエラー: {e}")
    print("簡易版で実行します")
    CarScraper = None
    GradeNormalizer = None

class LogHandler(logging.Handler):
    """GUIログハンドラー"""
    def __init__(self, log_queue):
        super().__init__()
        self.log_queue = log_queue
    
    def emit(self, record):
        self.log_queue.put(self.format(record))

class CarAnalysisGUI:
    def __init__(self, root):
        print("GUI初期化開始")
        self.root = root
        self.root.title("統合中古車分析システム")
        self.root.geometry("800x600")
        
        # ログキュー
        self.log_queue = queue.Queue()
        self.setup_logging()
        
        # データ格納
        self.available_cars = {}
        self.current_operation = None
        
        print("GUI構築開始")
        # GUI構築
        self.setup_gui()
        print("車種リスト更新開始")
        self.refresh_car_list()
        
        # ログ更新タイマー
        self.update_log_display()
        print("GUI初期化完了")
        
    def setup_logging(self):
        """ログ設定"""
        try:
            log_dir = project_root / 'logs'
            log_dir.mkdir(exist_ok=True)
            
            # ルートロガー設定
            logging.basicConfig(
                level=logging.INFO,
                format='%(asctime)s - %(levelname)s - %(message)s',
                handlers=[
                    logging.FileHandler(log_dir / 'gui.log', encoding='utf-8'),
                    LogHandler(self.log_queue)
                ]
            )
            self.logger = logging.getLogger(__name__)
            print("ログ設定完了")
        except Exception as e:
            print(f"ログ設定エラー: {e}")
            # 簡易ログ
            self.logger = logging.getLogger(__name__)
        
    def setup_gui(self):
        """GUI構築"""
        try:
            # メインフレーム
            main_frame = ttk.Frame(self.root, padding="10")
            main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
            
            # ウィンドウのリサイズ設定
            self.root.columnconfigure(0, weight=1)
            self.root.rowconfigure(0, weight=1)
            main_frame.columnconfigure(1, weight=1)
            main_frame.rowconfigure(3, weight=1)
            
            # タイトル
            title_label = ttk.Label(main_frame, text="🚗 統合中古車分析システム (デバッグ版)", 
                                   font=('Arial', 16, 'bold'))
            title_label.grid(row=0, column=0, columnspan=3, pady=(0, 20))
            
            # 操作選択フレーム
            operation_frame = ttk.LabelFrame(main_frame, text="操作選択", padding="10")
            operation_frame.grid(row=1, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=(0, 10))
            
            # スクレイピングボタン
            self.scrape_btn = ttk.Button(operation_frame, text="📥 データスクレイピング", 
                                        command=self.start_scraping, width=18)
            self.scrape_btn.grid(row=0, column=0, padx=(0, 5))
            
            # 分析ボタン
            self.analyze_btn = ttk.Button(operation_frame, text="📊 クレンジング&分析", 
                                         command=self.start_analysis, width=18)
            self.analyze_btn.grid(row=0, column=1, padx=(0, 5))
            
            # 更新ボタン
            self.refresh_btn = ttk.Button(operation_frame, text="🔄 リスト更新", 
                                         command=self.refresh_car_list, width=12)
            self.refresh_btn.grid(row=0, column=2)
            
            # 車種選択フレーム
            car_frame = ttk.LabelFrame(main_frame, text="車種選択", padding="10")
            car_frame.grid(row=2, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=(0, 10))
            car_frame.columnconfigure(0, weight=1)
            
            # 車種リスト
            self.car_listbox = tk.Listbox(car_frame, height=6, font=('Arial', 10))
            self.car_listbox.grid(row=0, column=0, sticky=(tk.W, tk.E))
            
            # スクロールバー
            car_scrollbar = ttk.Scrollbar(car_frame, orient="vertical", command=self.car_listbox.yview)
            car_scrollbar.grid(row=0, column=1, sticky=(tk.N, tk.S))
            self.car_listbox.configure(yscrollcommand=car_scrollbar.set)
            
            # ログ表示フレーム
            log_frame = ttk.LabelFrame(main_frame, text="実行ログ", padding="10")
            log_frame.grid(row=3, column=0, columnspan=3, sticky=(tk.W, tk.E, tk.N, tk.S))
            log_frame.columnconfigure(0, weight=1)
            log_frame.rowconfigure(0, weight=1)
            
            # ログテキストエリア
            self.log_text = scrolledtext.ScrolledText(log_frame, height=15, font=('Consolas', 9))
            self.log_text.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
            
            # ステータスバー
            self.status_var = tk.StringVar()
            self.status_var.set("準備完了 (デバッグモード)")
            status_bar = ttk.Label(main_frame, textvariable=self.status_var, 
                                  relief=tk.SUNKEN, font=('Arial', 9))
            status_bar.grid(row=4, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=(10, 0))
            
            print("GUI構築完了")
            
        except Exception as e:
            print(f"GUI構築エラー: {e}")
            import traceback
            traceback.print_exc()
        
    def refresh_car_list(self):
        """車種リスト更新"""
        try:
            print("車種リスト更新中...")
            self.car_listbox.delete(0, tk.END)
            self.available_cars = {}
            
            from src.utils import get_scraped_dir
            scraped_dir = get_scraped_dir(project_root)
            print(f"スクレイピングデータディレクトリ: {scraped_dir}")
            
            if not scraped_dir.exists():
                self.car_listbox.insert(tk.END, "スクレイピングデータがありません")
                print("スクレイピングデータディレクトリが存在しません")
                return
            
            car_count = 0
            for car_dir in scraped_dir.iterdir():
                if not car_dir.is_dir():
                    continue
                    
                display_name = self.get_display_car_name(car_dir.name)
                file_count = self.count_files_for_car(car_dir)
                
                if file_count > 0:
                    list_text = f"🚗 {display_name} ({file_count}ファイル)"
                    self.car_listbox.insert(tk.END, list_text)
                    self.available_cars[car_count] = {
                        'folder_name': car_dir.name,
                        'display_name': display_name,
                        'file_count': file_count
                    }
                    car_count += 1
                    print(f"車種追加: {display_name}")
            
            if car_count == 0:
                self.car_listbox.insert(tk.END, "利用可能な車種データがありません")
                
            self.status_var.set(f"車種リスト更新完了: {car_count}車種")
            print(f"車種リスト更新完了: {car_count}車種")
            
        except Exception as e:
            print(f"車種リスト更新エラー: {e}")
            import traceback
            traceback.print_exc()
            
    def get_display_car_name(self, folder_name):
        """表示用車種名取得（RC F の特別処理）"""
        if folder_name.upper() in ['F', 'RC_F', 'RCF']:
            return "RC F"
        return folder_name
        
    def count_files_for_car(self, car_dir):
        """指定車種のファイル数カウント"""
        try:
            count = 0
            for date_dir in car_dir.iterdir():
                if date_dir.is_dir():
                    count += len(list(date_dir.glob('*.csv')))
            return count
        except:
            return 0
        
    def start_scraping(self):
        """スクレイピング開始"""
        messagebox.showinfo("テスト", "スクレイピング機能（実装予定）")
        
    def start_analysis(self):
        """分析開始"""
        selection = self.car_listbox.curselection()
        if not selection:
            messagebox.showwarning("警告", "分析する車種を選択してください")
            return
            
        messagebox.showinfo("テスト", f"分析機能（実装予定）\n選択: {selection[0]}")
        
    def update_log_display(self):
        """ログ表示更新"""
        try:
            while True:
                log_message = self.log_queue.get_nowait()
                self.log_text.insert(tk.END, log_message + '\n')
                self.log_text.see(tk.END)
        except queue.Empty:
            pass
        
        # 100ms後に再実行
        self.root.after(100, self.update_log_display)

def main():
    """メイン関数"""
    print("メイン関数開始")
    
    try:
        root = tk.Tk()
        print("tkinter ルートウィンドウ作成成功")
        
        app = CarAnalysisGUI(root)
        print("アプリケーション初期化完了")
        
        print("メインループ開始")
        root.mainloop()
        print("メインループ終了")
        
    except Exception as e:
        print(f"メイン関数でエラー: {e}")
        import traceback
        traceback.print_exc()
        input("エラー詳細を確認してからEnterを押してください...")

if __name__ == '__main__':
    print("スクリプト実行開始")
    main()
    print("スクリプト実行完了")