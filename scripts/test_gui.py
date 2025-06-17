#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
テスト用簡単GUI
基本的なtkinterの動作確認
"""

import tkinter as tk
from tkinter import ttk, messagebox
import sys
from pathlib import Path

print("スクリプト開始")

try:
    print("tkinterインポート成功")
    
    # 基本ウィンドウ作成
    root = tk.Tk()
    root.title("テスト GUI")
    root.geometry("400x300")
    
    print("ウィンドウ作成成功")
    
    # テストボタン
    def test_button():
        messagebox.showinfo("テスト", "ボタンが正常に動作しています！")
    
    test_btn = ttk.Button(root, text="テストボタン", command=test_button)
    test_btn.pack(pady=20)
    
    # ラベル
    label = ttk.Label(root, text="GUI テストが成功しました", font=('Arial', 14))
    label.pack(pady=20)
    
    print("ウィジェット作成成功")
    print("メインループ開始")
    
    # メインループ開始
    root.mainloop()
    
    print("プログラム終了")
    
except Exception as e:
    print(f"エラー発生: {e}")
    import traceback
    traceback.print_exc()
    input("エラー詳細を確認してからEnterを押してください...")