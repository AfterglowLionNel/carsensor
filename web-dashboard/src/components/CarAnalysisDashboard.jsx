import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ScatterChart, Scatter, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { Car, TrendingUp, BarChart3, MapPin, Filter, Upload, Download, RefreshCw, AlertCircle, CheckCircle, Calendar } from 'lucide-react';
import Papa from 'papaparse';
import { 
  processCarData, 
  calculatePriceStats, 
  exportToCSV, 
  checkDataQuality,
  convertToLegacyFormat,
  parsePrice,
  parseYear,
  parseMileage,
  categorizeTransmission
} from '../utils/dataProcessor';

export default function CarAnalysisDashboard() {
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('overview');
  const [overviewMode, setOverviewMode] = useState('all');
  const [timeScale, setTimeScale] = useState('monthly');
  const [trendDateMode, setTrendDateMode] = useState('scraping'); // 'scraping' or 'year'
  const [selectedGrades, setSelectedGrades] = useState([]);
  const [yearRange, setYearRange] = useState({ min: 2014, max: 2025 });
  const [mileageMax, setMileageMax] = useState(200000);
  const [priceRange, setPriceRange] = useState([0, 2000]); // 配列形式に変更
  const [transmissionFilters, setTransmissionFilters] = useState({
    AT: true,
    CVT: true,  
    MT: true,
    other: true
  });
  const [repairHistoryFilter, setRepairHistoryFilter] = useState('all');
  const [showNormalizedGrades, setShowNormalizedGrades] = useState(true);
  const [fileUploaded, setFileUploaded] = useState(false);
  const [dataQuality, setDataQuality] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [selectedCarDetail, setSelectedCarDetail] = useState(null);
  const [showCarDetailModal, setShowCarDetailModal] = useState(false);

  // 車種とファイル選択の状態を追加
  const [selectedCarType, setSelectedCarType] = useState('');
  const [selectedFile, setSelectedFile] = useState('');
  const [availableCarTypes, setAvailableCarTypes] = useState(['F']); // RC Fのデフォルト
  const [availableFiles, setAvailableFiles] = useState([]);
  const [carTypeLoading, setCarTypeLoading] = useState(false);

  // 利用可能な車種を読み込む関数
  const loadAvailableCarTypes = async () => {
    try {
      setCarTypeLoading(true);
      // デモ用のデータセット
      const carTypes = ['F']; // RC F
      setAvailableCarTypes(carTypes);
      // デフォルトで RC F を選択
      if (carTypes.length > 0) {
        setSelectedCarType(carTypes[0]);
      }
    } catch (error) {
      console.error('車種読み込みエラー:', error);
    } finally {
      setCarTypeLoading(false);
    }
  };

  // 利用可能なファイルを読み込む関数
  const loadAvailableFiles = async (carType) => {
    try {
      if (!carType) return;
      
      // 実際のデータファイルを検索 - publicフォルダ配下のパスに修正
      const files = [
        {
          path: 'rc_f_data.json', // JSON形式のデータファイル
          displayName: '2025年06月18日データ (79台)',
          date: '2025-06-18'
        }
      ];
      
      setAvailableFiles(files);
      // デフォルトで最初のファイルを選択
      if (files.length > 0) {
        setSelectedFile(files[0].path);
      }
    } catch (error) {
      console.error('ファイル読み込みエラー:', error);
    }
  };

  // 選択されたファイルを読み込む関数
  const loadSelectedFile = async (filePath) => {
    try {
      if (!filePath) return;
      
      setLoading(true);
      
      // JSONファイルとCSVファイルの両方に対応
      try {
        const response = await fetch(`/data/${filePath}`);
        if (response.ok) {
          const contentType = response.headers.get('content-type');
          
          if (contentType && contentType.includes('application/json')) {
            // JSONファイルの場合
            const jsonData = await response.json();
            console.log('JSON実データ読み込み:', jsonData.length, '件');
            
            // JSONデータを処理
            const processedData = processCarData(jsonData);
            setRawData(processedData);
            setFileUploaded(true);
            setLastUpdate(new Date().toLocaleString());
            
            // データ品質チェック
            const quality = checkDataQuality(processedData);
            setDataQuality(quality);
            
            // 初期フィルター設定
            const uniqueGrades = [...new Set(processedData.map(item => 
              showNormalizedGrades ? item.正規グレード : item.元グレード
            ))].filter(Boolean);
            setSelectedGrades(uniqueGrades);
            
            // 価格範囲を自動調整
            const prices = processedData.map(item => item.price).filter(Boolean);
            if (prices.length > 0) {
              const minPrice = Math.floor(Math.min(...prices) / 100) * 100;
              const maxPrice = Math.ceil(Math.max(...prices) / 100) * 100;
              setPriceRange([minPrice, maxPrice]);
            }
            
          } else {
            // CSVファイルの場合
            const csvText = await response.text();
            Papa.parse(csvText, {
              header: true,
              encoding: 'UTF-8',
              complete: (results) => {
                console.log('CSV実データ読み込み:', results.data.length, '件');
                const processedData = processCarData(results.data);
                setRawData(processedData);
                setFileUploaded(true);
                setLastUpdate(new Date().toLocaleString());
                
                // データ品質チェック
                const quality = checkDataQuality(processedData);
                setDataQuality(quality);
                
                // 初期フィルター設定
                const uniqueGrades = [...new Set(processedData.map(item => 
                  showNormalizedGrades ? item.正規グレード : item.元グレード
                ))].filter(Boolean);
                setSelectedGrades(uniqueGrades);
                
                // 価格範囲を自動調整
                const prices = processedData.map(item => item.price).filter(Boolean);
                if (prices.length > 0) {
                  const minPrice = Math.floor(Math.min(...prices) / 100) * 100;
                  const maxPrice = Math.ceil(Math.max(...prices) / 100) * 100;
                  setPriceRange([minPrice, maxPrice]);
                }
                
                setLoading(false);
              },
              error: (error) => {
                console.error('CSV解析エラー:', error);
                setLoading(false);
                alert('CSVファイルの読み込みに失敗しました。');
              }
            });
          }
          
          setLoading(false);
        } else {
          console.error(`ファイルが見つかりません: ${filePath}`);
          setLoading(false);
          alert(`データファイルが見つかりません: ${filePath}\n\nファイルパス: /data/${filePath}`);
        }
      } catch (error) {
        console.error('ファイル読み込みエラー:', error);
        setLoading(false);
        alert(`データファイルの読み込み中にエラーが発生しました。\n\nエラー: ${error.message}\nファイルパス: /data/${filePath}`);
      }
    } catch (error) {
      console.error('loadSelectedFile エラー:', error);
      setLoading(false);
      alert('予期しないエラーが発生しました。');
    }
  };

  // データから日付を適切に取得する関数
  const getDateFromData = (item, mode) => {
    if (mode === 'scraping') {
      // スクレイピング取得日を使用
      if (item.取得日時) {
        return item.取得日時.substring(0, 10); // YYYY-MM-DD形式
      }
      // フォールバック: 2025年の日付を生成
      const month = Math.floor(Math.random() * 6) + 1; // 1-6月
      const day = Math.floor(Math.random() * 28) + 1;
      return `2025-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    } else {
      // 年式を使用
      return `${item.year}-01-01`;
    }
  };

  // サンプルデータ生成を削除（実データのみ使用）
  // generateSampleData関数は削除

  // CSVファイルアップロード処理
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    Papa.parse(file, {
      header: true,
      encoding: 'UTF-8',
      complete: (results) => {
        console.log('アップロードされたCSV:', results.data);
        const processedData = processCarData(results.data);
        setRawData(processedData);
        setFileUploaded(true);
        setLastUpdate(new Date().toLocaleString());
        
        // データ品質チェック
        const quality = checkDataQuality(processedData);
        setDataQuality(quality);
        
        // 初期フィルター設定
        const uniqueGrades = [...new Set(processedData.map(item => 
          showNormalizedGrades ? item.正規グレード : item.元グレード
        ))].filter(Boolean);
        setSelectedGrades(uniqueGrades);
        
        // 価格範囲を自動調整
        const prices = processedData.map(item => item.price).filter(Boolean);
        if (prices.length > 0) {
          const minPrice = Math.floor(Math.min(...prices) / 100) * 100;
          const maxPrice = Math.ceil(Math.max(...prices) / 100) * 100;
          setPriceRange([minPrice, maxPrice]);
        }
        
        setLoading(false);
      },
      error: (error) => {
        console.error('CSV解析エラー:', error);
        setLoading(false);
        alert('CSVファイルの読み込みに失敗しました。');
      }
    });
  };

  // 初期化処理
  useEffect(() => {
    loadAvailableCarTypes();
  }, []);

  // 車種選択時の処理
  useEffect(() => {
    if (selectedCarType) {
      loadAvailableFiles(selectedCarType);
    }
  }, [selectedCarType]);

  // ファイル選択時の処理
  useEffect(() => {
    if (selectedFile) {
      loadSelectedFile(selectedFile);
    }
  }, [selectedFile]);

  // データソース別処理
  const processedData = useMemo(() => {
    if (overviewMode === 'latest') {
      const latestData = rawData.filter((item, index, self) => {
        return index === self.findIndex(t => 
          t.price === item.price && 
          t.year === item.year && 
          t.mileage === item.mileage && 
          t.正規グレード === item.正規グレード
        );
      });
      return latestData.slice(-50);
    } else {
      const allData = rawData.filter((item, index, self) => {
        return index === self.findIndex(t => 
          t.price === item.price && 
          t.year === item.year && 
          t.mileage === item.mileage && 
          t.正規グレード === item.正規グレード
        );
      });
      return allData;
    }
  }, [rawData, overviewMode]);

  // フィルター適用後のデータ
  const filteredData = useMemo(() => {
    return processedData.filter(item => {
      const targetGrade = showNormalizedGrades ? item.正規グレード : item.元グレード;
      
      // グレードフィルター
      if (selectedGrades.length > 0 && !selectedGrades.includes(targetGrade)) return false;
      
      // 年式フィルター
      if (item.year < yearRange.min || item.year > yearRange.max) return false;
      
      // 走行距離フィルター
      if (item.mileage > mileageMax) return false;
      
      // 価格フィルター（配列形式）
      if (item.price < priceRange[0] || item.price > priceRange[1]) return false;
      
      // ミッションフィルター（チェックボックス形式）
      const transmissionCategory = categorizeTransmission(item.ミッション);
      if (!transmissionFilters[transmissionCategory]) return false;
      
      // 修復歴フィルター
      if (repairHistoryFilter !== 'all') {
        if (repairHistoryFilter === 'none' && item.修復歴 !== 'なし') return false;
        if (repairHistoryFilter === 'exists' && item.修復歴 !== 'あり') return false;
      }
      
      return true;
    });
  }, [processedData, selectedGrades, yearRange, mileageMax, priceRange, transmissionFilters, repairHistoryFilter, showNormalizedGrades]);

  // 価格推移データの生成（日付モード対応）
  const trendData = useMemo(() => {
    if (filteredData.length === 0) return [];
    
    const grouped = {};
    filteredData.forEach(item => {
      const dateStr = getDateFromData(item, trendDateMode);
      let key;
      
      if (trendDateMode === 'scraping') {
        if (timeScale === 'daily') {
          key = dateStr.substring(0, 10); // YYYY-MM-DD
        } else if (timeScale === 'monthly') {
          key = dateStr.substring(0, 7); // YYYY-MM
        } else {
          key = dateStr.substring(0, 4); // YYYY
        }
      } else {
        // 年式基準の場合
        key = item.year.toString();
      }
      
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(item);
    });

    return Object.entries(grouped)
      .map(([key, items]) => {
        const stats = calculatePriceStats(items.map(item => item.price));
        return {
          date: key,
          avgPrice: stats.mean,
          count: items.length,
          maxPrice: stats.max,
          minPrice: stats.min,
          median: stats.median
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredData, timeScale, trendDateMode]);

  // 価格推移から単純回帰で予測値を生成
  const forecastData = useMemo(() => {
    if (trendDateMode !== 'scraping' || trendData.length < 2) return [];

    const n = trendData.length;
    const sumX = trendData.reduce((acc, _, i) => acc + i, 0);
    const sumY = trendData.reduce((acc, d) => acc + d.avgPrice, 0);
    const sumXY = trendData.reduce((acc, d, i) => acc + i * d.avgPrice, 0);
    const sumX2 = trendData.reduce((acc, _, i) => acc + i * i, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const parseDateString = (str) => {
      if (timeScale === 'yearly') return new Date(`${str}-01-01`);
      if (timeScale === 'monthly') return new Date(`${str}-01`);
      return new Date(str);
    };

    const formatDate = (date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      if (timeScale === 'yearly') return `${y}`;
      if (timeScale === 'monthly') return `${y}-${m}`;
      return `${y}-${m}-${d}`;
    };

    const lastDate = parseDateString(trendData[trendData.length - 1].date);
    const results = [];
    for (let i = 1; i <= 3; i++) {
      const idx = n + i - 1;
      const forecastPrice = Math.round((slope * idx + intercept) * 10) / 10;
      const nextDate = new Date(lastDate.getTime());
      if (timeScale === 'yearly') {
        nextDate.setFullYear(nextDate.getFullYear() + i);
      } else if (timeScale === 'monthly') {
        nextDate.setMonth(nextDate.getMonth() + i);
      } else {
        nextDate.setDate(nextDate.getDate() + i);
      }
      results.push({
        date: formatDate(nextDate),
        forecastPrice,
        avgPrice: null,
        maxPrice: null,
        minPrice: null,
        median: null
      });
    }
    return results;
  }, [trendData, timeScale]);

  const trendDataWithForecast = useMemo(
    () =>
      trendDateMode === 'scraping'
        ? [...trendData, ...forecastData]
        : trendData,
    [trendData, forecastData, trendDateMode]
  );

  // グレード別分析データ
  const gradeAnalysisData = useMemo(() => {
    if (filteredData.length === 0) return [];
    
    const gradeStats = {};
    filteredData.forEach(item => {
      const grade = showNormalizedGrades ? item.正規グレード : item.元グレード;
      if (!gradeStats[grade]) {
        gradeStats[grade] = {
          prices: [],
          years: [],
          mileages: [],
          matchingScores: []
        };
      }
      gradeStats[grade].prices.push(item.price);
      gradeStats[grade].years.push(item.year);
      gradeStats[grade].mileages.push(item.mileage);
      gradeStats[grade].matchingScores.push(item.マッチング精度);
    });

    return Object.entries(gradeStats)
      .map(([grade, stats]) => {
        const priceStats = calculatePriceStats(stats.prices);
        return {
          grade: grade.length > 15 ? grade.substring(0, 15) + '...' : grade,
          fullGrade: grade,
          avgPrice: priceStats.mean,
          minPrice: priceStats.min,
          maxPrice: priceStats.max,
          median: priceStats.median,
          count: priceStats.count,
          avgYear: Math.round(stats.years.reduce((sum, year) => sum + year, 0) / stats.years.length),
          avgMileage: Math.round(stats.mileages.reduce((sum, mileage) => sum + mileage, 0) / stats.mileages.length),
          avgMatchingScore: Math.round(stats.matchingScores.reduce((sum, score) => sum + score, 0) / stats.matchingScores.length * 100) / 100
        };
      })
      .sort((a, b) => b.avgPrice - a.avgPrice);
  }, [filteredData, showNormalizedGrades]);

  // 年式分布データ
  const yearDistributionData = useMemo(() => {
    const yearCounts = {};
    filteredData.forEach(item => {
      yearCounts[item.year] = (yearCounts[item.year] || 0) + 1;
    });
    
    return Object.entries(yearCounts)
      .map(([year, count]) => ({ year: parseInt(year), count }))
      .sort((a, b) => a.year - b.year);
  }, [filteredData]);

  // 修復歴統計
  const repairHistoryData = useMemo(() => {
    const stats = { あり: 0, なし: 0 };
    filteredData.forEach(item => {
      stats[item.修復歴] = (stats[item.修復歴] || 0) + 1;
    });
    
    return [
      { name: '修復歴なし', value: stats.なし, fill: '#10b981' },
      { name: '修復歴あり', value: stats.あり, fill: '#ef4444' }
    ];
  }, [filteredData]);

  // 利用可能なグレード一覧
  const availableGrades = useMemo(() => {
    return [...new Set(processedData.map(item => 
      showNormalizedGrades ? item.正規グレード : item.元グレード
    ))].filter(Boolean).sort();
  }, [processedData, showNormalizedGrades]);

  // グレード選択切り替え
  const handleGradeToggle = (grade) => {
    setSelectedGrades(prev => 
      prev.includes(grade) 
        ? prev.filter(g => g !== grade)
        : [...prev, grade]
    );
  };

  // 全選択/全解除
  const handleSelectAllGrades = () => {
    setSelectedGrades(selectedGrades.length === availableGrades.length ? [] : availableGrades);
  };

  // グレード表示切り替え
  const handleGradeTypeChange = (useNormalized) => {
    setShowNormalizedGrades(useNormalized);
    const uniqueGrades = [...new Set(processedData.map(item => 
      useNormalized ? item.正規グレード : item.元グレード
    ))].filter(Boolean);
    setSelectedGrades(uniqueGrades);
  };

  // ミッション切り替え
  const handleTransmissionToggle = (category) => {
    setTransmissionFilters(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  // 車両詳細クリック処理
  const handleCarClick = (carData) => {
    setSelectedCarDetail(carData);
    setShowCarDetailModal(true);
  };

  // データエクスポート
  const handleExportData = () => {
    const exportData = convertToLegacyFormat(filteredData);
    exportToCSV(exportData, `rc_f_analysis_${new Date().toISOString().split('T')[0]}.csv`);
  };

  // 統合レンジスライダーコンポーネント（完全修正版）
  const RangeSlider = ({ min, max, value, onChange, step = 1, unit = '' }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [dragIndex, setDragIndex] = useState(null);
    
    const handleRangeChange = (index, newValue) => {
      const numValue = parseInt(newValue);
      const newRange = [...value];
      
      if (index === 0) {
        // 下限スライダー
        newRange[0] = Math.max(min, Math.min(newValue, newRange[1] - step));
      } else {
        // 上限スライダー
        newRange[1] = Math.max(newRange[0] + step, Math.min(max, newValue));
      }
      
      onChange(newRange);
    };

    const leftPercent = ((value[0] - min) / (max - min)) * 100;
    const rightPercent = ((value[1] - min) / (max - min)) * 100;

    return (
      <div style={{ position: 'relative', margin: '20px 0' }}>
        {/* トラック背景 */}
        <div style={{
          height: '8px',
          backgroundColor: '#e5e7eb',
          borderRadius: '4px',
          position: 'relative',
          marginBottom: '24px'
        }}>
          {/* アクティブ範囲 */}
          <div style={{
            position: 'absolute',
            height: '8px',
            backgroundColor: '#3b82f6',
            borderRadius: '4px',
            left: `${leftPercent}%`,
            width: `${rightPercent - leftPercent}%`,
            zIndex: 1
          }}></div>
        </div>
        
        {/* 下限スライダー */}
        <input
          type="range"
          min={min}
          max={max}
          value={value[0]}
          step={step}
          onChange={(e) => handleRangeChange(0, parseInt(e.target.value))}
          onMouseDown={() => {
            setIsDragging(true);
            setDragIndex(0);
          }}
          onMouseUp={() => {
            setIsDragging(false);
            setDragIndex(null);
          }}
          style={{
            position: 'absolute',
            top: '-16px',
            left: '0',
            width: '100%',
            height: '32px',
            background: 'transparent',
            outline: 'none',
            appearance: 'none',
            cursor: 'pointer',
            zIndex: dragIndex === 0 ? 5 : 3,
            pointerEvents: 'auto'
          }}
        />
        
        {/* 上限スライダー */}
        <input
          type="range"
          min={min}
          max={max}
          value={value[1]}
          step={step}
          onChange={(e) => handleRangeChange(1, parseInt(e.target.value))}
          onMouseDown={() => {
            setIsDragging(true);
            setDragIndex(1);
          }}
          onMouseUp={() => {
            setIsDragging(false);
            setDragIndex(null);
          }}
          style={{
            position: 'absolute',
            top: '-16px',
            left: '0',
            width: '100%',
            height: '32px',
            background: 'transparent',
            outline: 'none',
            appearance: 'none',
            cursor: 'pointer',
            zIndex: dragIndex === 1 ? 5 : 2,
            pointerEvents: 'auto'
          }}
        />
        
        {/* 値表示 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '8px',
          fontSize: '14px',
          color: '#6b7280'
        }}>
          <span style={{ 
            fontWeight: '500',
            color: dragIndex === 0 ? '#3b82f6' : '#6b7280'
          }}>
            {value[0]}{unit}
          </span>
          <span style={{ 
            fontWeight: '500',
            color: dragIndex === 1 ? '#3b82f6' : '#6b7280'
          }}>
            {value[1]}{unit}
          </span>
        </div>
      </div>
    );
  };

  if (loading || carTypeLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh', 
        backgroundColor: '#f9fafb' 
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: '48px', 
            height: '48px', 
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p style={{ color: '#6b7280' }}>
            {carTypeLoading ? '車種を検索中...' : 'データを読み込み中...'}
          </p>
        </div>
      </div>
    );
  }

  // データが選択されていない場合の表示
  if (!selectedCarType || !selectedFile) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
        {/* ヘッダー */}
        <div style={{ 
          backgroundColor: 'white', 
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', 
          borderBottom: '1px solid #e5e7eb' 
        }}>
          <div style={{ 
            maxWidth: '1280px', 
            margin: '0 auto', 
            padding: '0 16px' 
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: '16px 0' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Car size={32} color="#2563eb" />
                <div>
                  <h1 style={{ 
                    fontSize: '24px', 
                    fontWeight: 'bold', 
                    color: '#111827', 
                    margin: '0' 
                  }}>
                    中古車分析ダッシュボード
                  </h1>
                  <p style={{ 
                    fontSize: '14px', 
                    color: '#6b7280', 
                    margin: '4px 0 0 0' 
                  }}>
                    車種とデータファイルを選択してください
                  </p>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {/* 車種選択 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontSize: '14px', fontWeight: '500', color: '#374751' }}>
                    車種:
                  </label>
                  <select
                    value={selectedCarType}
                    onChange={(e) => setSelectedCarType(e.target.value)}
                    style={{
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      fontSize: '14px',
                      backgroundColor: 'white',
                      minWidth: '120px'
                    }}
                  >
                    <option value="">車種を選択</option>
                    {availableCarTypes.map(carType => (
                      <option key={carType} value={carType}>
                        {carType === 'F' ? 'RC F' : carType}
                      </option>
                    ))}
                  </select>
                </div>

                {/* ファイル選択 */}
                {selectedCarType && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '14px', fontWeight: '500', color: '#374751' }}>
                      データ:
                    </label>
                    <select
                      value={selectedFile}
                      onChange={(e) => setSelectedFile(e.target.value)}
                      style={{
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        fontSize: '14px',
                        backgroundColor: 'white',
                        minWidth: '200px'
                      }}
                    >
                      <option value="">ファイルを選択</option>
                      {availableFiles.map(file => (
                        <option key={file.path} value={file.path}>
                          {file.displayName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 選択促進メッセージ */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: 'calc(100vh - 120px)' 
        }}>
          <div style={{ 
            textAlign: 'center', 
            backgroundColor: 'white', 
            padding: '48px', 
            borderRadius: '12px', 
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' 
          }}>
            <Car size={64} color="#6b7280" style={{ margin: '0 auto 24px' }} />
            <h2 style={{ 
              fontSize: '24px', 
              fontWeight: '600', 
              color: '#111827', 
              marginBottom: '16px' 
            }}>
              車種とデータを選択
            </h2>
            <p style={{ 
              fontSize: '16px', 
              color: '#6b7280', 
              marginBottom: '24px',
              maxWidth: '400px'
            }}>
              {!selectedCarType 
                ? '上部のドロップダウンから分析したい車種を選択してください。' 
                : 'データファイルを選択して分析を開始してください。'
              }
            </p>
            
            {availableCarTypes.length > 0 && (
              <div style={{ 
                padding: '16px', 
                backgroundColor: '#f9fafb', 
                borderRadius: '8px',
                marginTop: '16px'
              }}>
                <p style={{ 
                  fontSize: '14px', 
                  color: '#374751', 
                  marginBottom: '8px',
                  fontWeight: '500'
                }}>
                  利用可能な車種:
                </p>
                <div style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '8px',
                  justifyContent: 'center'
                }}>
                  {availableCarTypes.map(carType => (
                    <span key={carType} style={{
                      padding: '4px 12px',
                      backgroundColor: '#e5e7eb',
                      borderRadius: '16px',
                      fontSize: '14px',
                      color: '#374751'
                    }}>
                      {carType === 'F' ? 'RC F' : carType}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      {/* ヘッダー */}
      <div style={{ 
        backgroundColor: 'white', 
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', 
        borderBottom: '1px solid #e5e7eb' 
      }}>
        <div style={{ 
          maxWidth: '1280px', 
          margin: '0 auto', 
          padding: '0 16px' 
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '16px 0' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Car size={32} color="#2563eb" />
              <div>
                <h1 style={{ 
                  fontSize: '24px', 
                  fontWeight: 'bold', 
                  color: '#111827', 
                  margin: '0' 
                }}>
                  中古車分析ダッシュボード
                </h1>
                <p style={{ 
                  fontSize: '14px', 
                  color: '#6b7280', 
                  margin: '4px 0 0 0' 
                }}>
                  {selectedCarType && `車種: ${selectedCarType}`}
                  {lastUpdate && ` | 最終更新: ${lastUpdate}`}
                </p>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {/* 車種選択ドロップダウン */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '14px', fontWeight: '500', color: '#374751' }}>
                  車種:
                </label>
                <select
                  value={selectedCarType}
                  onChange={(e) => setSelectedCarType(e.target.value)}
                  disabled={carTypeLoading}
                  style={{
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '14px',
                    backgroundColor: 'white',
                    minWidth: '120px'
                  }}
                >
                  <option value="">車種を選択</option>
                  {availableCarTypes.map(carType => (
                    <option key={carType} value={carType}>
                      {carType === 'F' ? 'RC F' : carType}
                    </option>
                  ))}
                </select>
              </div>

              {/* ファイル選択ドロップダウン */}
              {selectedCarType && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontSize: '14px', fontWeight: '500', color: '#374751' }}>
                    データ:
                  </label>
                  <select
                    value={selectedFile}
                    onChange={(e) => setSelectedFile(e.target.value)}
                    disabled={loading}
                    style={{
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      fontSize: '14px',
                      backgroundColor: 'white',
                      minWidth: '200px'
                    }}
                  >
                    <option value="">ファイルを選択</option>
                    {availableFiles.map(file => (
                      <option key={file.path} value={file.path}>
                        {file.displayName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* データ品質インジケーター */}
              {dataQuality && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {dataQuality.qualityScore >= 90 ? (
                    <CheckCircle size={20} color="#10b981" />
                  ) : (
                    <AlertCircle size={20} color="#f59e0b" />
                  )}
                  <span style={{ fontSize: '14px', color: '#6b7280' }}>
                    品質: {dataQuality.qualityScore}%
                  </span>
                </div>
              )}
              
              <button
                onClick={handleExportData}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                <Download size={16} />
                エクスポート
              </button>
              
              {/* ファイルアップロード */}
              <div style={{ position: 'relative' }}>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  style={{
                    position: 'absolute',
                    inset: '0',
                    width: '100%',
                    height: '100%',
                    opacity: '0',
                    cursor: 'pointer'
                  }}
                />
                <button style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}>
                  <Upload size={16} />
                  CSVアップロード
                </button>
              </div>
              
              <span style={{ fontSize: '14px', color: '#6b7280' }}>
                {selectedCarType ? (
                  <>
                    表示中: <span style={{ fontWeight: '600', color: '#3b82f6' }}>{filteredData.length}</span>件 / 
                    全<span style={{ fontWeight: '600' }}>{rawData.length}</span>件
                    {filteredData.length !== rawData.length && (
                      <span style={{ color: '#ef4444', marginLeft: '8px' }}>
                        ({rawData.length - filteredData.length}件フィルター中)
                      </span>
                    )}
                  </>
                ) : (
                  '車種を選択してください'
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '24px' }}>
          
          {/* サイドバー - フィルター */}
          <div>
            <div style={{ 
              backgroundColor: 'white', 
              borderRadius: '8px', 
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', 
              border: '1px solid #e5e7eb', 
              padding: '16px',
              position: 'sticky',
              top: '24px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Filter size={20} color="#6b7280" />
                <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', margin: '0' }}>フィルター</h2>
              </div>

              {/* データ品質情報 */}
              {dataQuality && (
                <div style={{ 
                  marginBottom: '24px', 
                  padding: '12px', 
                  backgroundColor: '#f9fafb', 
                  borderRadius: '6px' 
                }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '500', color: '#374751', marginBottom: '8px' }}>データ品質</h3>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    <div style={{ marginBottom: '4px' }}>有効データ: {dataQuality.validCount}件</div>
                    <div>品質スコア: {dataQuality.qualityScore}%</div>
                  </div>
                </div>
              )}

              {/* グレード表示切り替え */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ 
                  display: 'block', 
                  fontSize: '14px', 
                  fontWeight: '500', 
                  color: '#374751', 
                  marginBottom: '8px' 
                }}>
                  グレード表示
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center' }}>
                    <input
                      type="radio"
                      checked={showNormalizedGrades}
                      onChange={() => handleGradeTypeChange(true)}
                      style={{ marginRight: '8px', accentColor: '#3b82f6' }}
                    />
                    <span style={{ fontSize: '14px' }}>正規グレード</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center' }}>
                    <input
                      type="radio"
                      checked={!showNormalizedGrades}
                      onChange={() => handleGradeTypeChange(false)}
                      style={{ marginRight: '8px', accentColor: '#3b82f6' }}
                    />
                    <span style={{ fontSize: '14px' }}>元グレード</span>
                  </label>
                </div>
              </div>

              {/* グレード選択 */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  marginBottom: '8px' 
                }}>
                  <label style={{ 
                    fontSize: '14px', 
                    fontWeight: '500', 
                    color: '#374751' 
                  }}>
                    グレード選択
                  </label>
                  <button
                    onClick={handleSelectAllGrades}
                    style={{
                      fontSize: '12px',
                      color: '#3b82f6',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                  >
                    {selectedGrades.length === availableGrades.length ? '全解除' : '全選択'}
                  </button>
                </div>
                <div style={{ 
                  maxHeight: '200px', 
                  overflowY: 'auto', 
                  border: '1px solid #d1d5db', 
                  borderRadius: '6px', 
                  padding: '8px', 
                  backgroundColor: '#f9fafb' 
                }}>
                  {availableGrades.map(grade => (
                    <label key={grade} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      marginBottom: '4px', 
                      padding: '4px', 
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="checkbox"
                        checked={selectedGrades.includes(grade)}
                        onChange={() => handleGradeToggle(grade)}
                        style={{ marginRight: '8px', accentColor: '#3b82f6' }}
                      />
                      <span style={{ 
                        fontSize: '14px', 
                        color: '#374751',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }} title={grade}>
                        {grade}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 年式範囲 */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ 
                  display: 'block', 
                  fontSize: '14px', 
                  fontWeight: '500', 
                  color: '#374751', 
                  marginBottom: '8px' 
                }}>
                  年式範囲
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    value={yearRange.min}
                    onChange={(e) => setYearRange(prev => ({ ...prev, min: parseInt(e.target.value) }))}
                    min="2014"
                    max="2025"
                    style={{
                      width: '80px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      fontSize: '14px'
                    }}
                  />
                  <span style={{ color: '#6b7280' }}>〜</span>
                  <input
                    type="number"
                    value={yearRange.max}
                    onChange={(e) => setYearRange(prev => ({ ...prev, max: parseInt(e.target.value) }))}
                    min="2014"
                    max="2025"
                    style={{
                      width: '80px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>

              {/* 価格範囲（統合レンジスライダー） */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ 
                  display: 'block', 
                  fontSize: '14px', 
                  fontWeight: '500', 
                  color: '#374751', 
                  marginBottom: '8px' 
                }}>
                  価格範囲
                </label>
                
                {/* 価格入力フィールド */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <input
                    type="number"
                    value={priceRange[0]}
                    onChange={(e) => setPriceRange(prev => [parseInt(e.target.value) || 0, prev[1]])}
                    min="0"
                    max="2000"
                    placeholder="下限"
                    style={{
                      width: '80px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      fontSize: '14px'
                    }}
                  />
                  <span style={{ color: '#6b7280' }}>〜</span>
                  <input
                    type="number"
                    value={priceRange[1]}
                    onChange={(e) => setPriceRange(prev => [prev[0], parseInt(e.target.value) || 2000])}
                    min="0"
                    max="2000"
                    placeholder="上限"
                    style={{
                      width: '80px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                {/* 統合レンジスライダー */}
                <RangeSlider
                  min={0}
                  max={2000}
                  value={priceRange}
                  onChange={setPriceRange}
                  step={50}
                  unit="万円"
                />
              </div>

              {/* 走行距離 */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ 
                  display: 'block', 
                  fontSize: '14px', 
                  fontWeight: '500', 
                  color: '#374751', 
                  marginBottom: '8px' 
                }}>
                  走行距離上限: {Math.round(mileageMax / 10000 * 10) / 10}万km
                </label>
                
                {/* 走行距離スライダー（可視化改善） */}
                <div style={{ position: 'relative', margin: '12px 0' }}>
                  {/* トラック背景 */}
                  <div style={{
                    height: '8px',
                    backgroundColor: '#e5e7eb',
                    borderRadius: '4px',
                    position: 'relative',
                    marginBottom: '16px'
                  }}>
                    {/* アクティブ部分 */}
                    <div style={{
                      position: 'absolute',
                      height: '8px',
                      backgroundColor: '#10b981',
                      borderRadius: '4px',
                      left: '0%',
                      width: `${(mileageMax / 200000) * 100}%`,
                      zIndex: 1
                    }}></div>
                  </div>
                  
                  {/* スライダー */}
                  <input
                    type="range"
                    min="0"
                    max="200000"
                    step="10000"
                    value={mileageMax}
                    onChange={(e) => setMileageMax(parseInt(e.target.value))}
                    style={{
                      position: 'absolute',
                      top: '-12px',
                      left: '0',
                      width: '100%',
                      height: '32px',
                      background: 'transparent',
                      outline: 'none',
                      appearance: 'none',
                      cursor: 'pointer',
                      zIndex: 2
                    }}
                  />
                  
                  {/* 目盛り表示 */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '8px',
                    fontSize: '12px',
                    color: '#9ca3af'
                  }}>
                    <span>0万km</span>
                    <span>10万km</span>
                    <span>20万km</span>
                  </div>
                </div>
              </div>

              {/* ミッション（チェックボックス形式） */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ 
                  display: 'block', 
                  fontSize: '14px', 
                  fontWeight: '500', 
                  color: '#374751', 
                  marginBottom: '8px' 
                }}>
                  ミッション
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {Object.entries({
                    AT: 'AT（オートマ）',
                    CVT: 'CVT',
                    MT: 'MT（マニュアル）',
                    other: 'その他'
                  }).map(([key, label]) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={transmissionFilters[key]}
                        onChange={() => handleTransmissionToggle(key)}
                        style={{ marginRight: '8px', accentColor: '#3b82f6' }}
                      />
                      <span style={{ fontSize: '14px' }}>{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 修復歴 */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ 
                  display: 'block', 
                  fontSize: '14px', 
                  fontWeight: '500', 
                  color: '#374751', 
                  marginBottom: '8px' 
                }}>
                  修復歴
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center' }}>
                    <input
                      type="radio"
                      checked={repairHistoryFilter === 'all'}
                      onChange={() => setRepairHistoryFilter('all')}
                      style={{ marginRight: '8px', accentColor: '#3b82f6' }}
                    />
                    <span style={{ fontSize: '14px' }}>すべて</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center' }}>
                    <input
                      type="radio"
                      checked={repairHistoryFilter === 'none'}
                      onChange={() => setRepairHistoryFilter('none')}
                      style={{ marginRight: '8px', accentColor: '#3b82f6' }}
                    />
                    <span style={{ fontSize: '14px' }}>修復歴なし</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center' }}>
                    <input
                      type="radio"
                      checked={repairHistoryFilter === 'exists'}
                      onChange={() => setRepairHistoryFilter('exists')}
                      style={{ marginRight: '8px', accentColor: '#3b82f6' }}
                    />
                    <span style={{ fontSize: '14px' }}>修復歴あり</span>
                  </label>
                </div>
              </div>

              {/* フィルターリセット */}
              <div style={{ marginBottom: '16px' }}>
                <button
                  onClick={() => {
                    setYearRange({ min: 2014, max: 2025 });
                    setPriceRange([0, 2000]);
                    setMileageMax(200000);
                    setTransmissionFilters({ AT: true, CVT: true, MT: true, other: true });
                    setRepairHistoryFilter('all');
                    setSelectedGrades(availableGrades);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: '#f3f4f6',
                    color: '#374751',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  フィルターをリセット
                </button>
              </div>
            </div>
          </div>

          {/* メインコンテンツ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* 表示モード選択 */}
            <div style={{ 
              backgroundColor: 'white', 
              borderRadius: '8px', 
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', 
              border: '1px solid #e5e7eb', 
              padding: '16px' 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {[
                    { key: 'overview', label: '概要', icon: BarChart3 },
                    { key: 'trend', label: '価格推移', icon: TrendingUp },
                    { key: 'grades', label: 'グレード分析', icon: BarChart3 },
                    { key: 'scatter', label: '走行距離vs価格', icon: MapPin }
                  ].map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => setViewMode(key)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '14px',
                        backgroundColor: viewMode === key ? '#3b82f6' : '#f3f4f6',
                        color: viewMode === key ? 'white' : '#374751',
                        boxShadow: viewMode === key ? '0 1px 3px 0 rgba(0, 0, 0, 0.1)' : 'none'
                      }}
                    >
                      <Icon size={16} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>

                {/* 概要モード切り替え */}
                {viewMode === 'overview' && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => setOverviewMode('all')}
                      style={{
                        padding: '4px 12px',
                        borderRadius: '6px',
                        fontSize: '14px',
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: overviewMode === 'all' ? '#10b981' : '#f3f4f6',
                        color: overviewMode === 'all' ? 'white' : '#374751'
                      }}
                    >
                      全期間
                    </button>
                    <button
                      onClick={() => setOverviewMode('latest')}
                      style={{
                        padding: '4px 12px',
                        borderRadius: '6px',
                        fontSize: '14px',
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: overviewMode === 'latest' ? '#10b981' : '#f3f4f6',
                        color: overviewMode === 'latest' ? 'white' : '#374751'
                      }}
                    >
                      最新
                    </button>
                  </div>
                )}
              </div>
              
              {/* データソース表示 */}
              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                {overviewMode === 'all' ? '全期間の累計データ（重複除去済み）' : '最新データセット'}
              </div>
            </div>

            {/* 統計カード */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
              <div style={{ 
                backgroundColor: 'white', 
                borderRadius: '8px', 
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', 
                border: '1px solid #e5e7eb', 
                padding: '20px' 
              }}>
                <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>平均価格</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#3b82f6' }}>
                  {filteredData.length > 0 
                    ? `${Math.round(filteredData.reduce((sum, item) => sum + item.price, 0) / filteredData.length * 10) / 10}万円`
                    : '-'
                  }
                </div>
              </div>
              <div style={{ 
                backgroundColor: 'white', 
                borderRadius: '8px', 
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', 
                border: '1px solid #e5e7eb', 
                padding: '20px' 
              }}>
                <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>価格帯</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#10b981' }}>
                  {filteredData.length > 0 
                    ? `${Math.min(...filteredData.map(item => item.price))}万円`
                    : '-'
                  }
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  {filteredData.length > 0 
                    ? `〜 ${Math.max(...filteredData.map(item => item.price))}万円`
                    : ''
                  }
                </div>
              </div>
              <div style={{ 
                backgroundColor: 'white', 
                borderRadius: '8px', 
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', 
                border: '1px solid #e5e7eb', 
                padding: '20px' 
              }}>
                <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>グレード数</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#8b5cf6' }}>
                  {availableGrades.length}種類
                </div>
              </div>
              <div style={{ 
                backgroundColor: 'white', 
                borderRadius: '8px', 
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', 
                border: '1px solid #e5e7eb', 
                padding: '20px' 
              }}>
                <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>平均年式</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#f59e0b' }}>
                  {filteredData.length > 0 
                    ? `${Math.round(filteredData.reduce((sum, item) => sum + item.year, 0) / filteredData.length)}年`
                    : '-'
                  }
                </div>
              </div>
              <div style={{ 
                backgroundColor: 'white', 
                borderRadius: '8px', 
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', 
                border: '1px solid #e5e7eb', 
                padding: '20px' 
              }}>
                <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>修復歴なし</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#ef4444' }}>
                  {filteredData.length > 0 
                    ? `${Math.round(filteredData.filter(item => item.修復歴 === 'なし').length / filteredData.length * 100)}%`
                    : '-'
                  }
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  {filteredData.filter(item => item.修復歴 === 'なし').length}台
                </div>
              </div>
            </div>

            {/* グラフエリア */}
            {viewMode === 'overview' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                {/* 年式分布 */}
                <div style={{ 
                  backgroundColor: 'white', 
                  borderRadius: '8px', 
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', 
                  border: '1px solid #e5e7eb', 
                  padding: '24px' 
                }}>
                  <h3 style={{ 
                    fontSize: '18px', 
                    fontWeight: '600', 
                    color: '#111827', 
                    marginBottom: '16px' 
                  }}>
                    年式分布
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={yearDistributionData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="year" stroke="#666" />
                      <YAxis stroke="#666" />
                      <Tooltip 
                        formatter={(value) => [`${value}台`, '台数']}
                        labelFormatter={(label) => `${label}年`}
                      />
                      <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* 修復歴統計 */}
                <div style={{ 
                  backgroundColor: 'white', 
                  borderRadius: '8px', 
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', 
                  border: '1px solid #e5e7eb', 
                  padding: '24px' 
                }}>
                  <h3 style={{ 
                    fontSize: '18px', 
                    fontWeight: '600', 
                    color: '#111827', 
                    marginBottom: '16px' 
                  }}>
                    修復歴統計
                  </h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={repairHistoryData}
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        innerRadius={35}
                        dataKey="value"
                        label={false} // ラベル非表示
                        labelLine={false}
                      >
                        {repairHistoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value, name) => [`${value}台`, name]}
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '14px'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  
                  {/* 統計情報を表で表示（レイアウト改善） */}
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {repairHistoryData.map((item, index) => (
                        <div key={index} style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 16px',
                          backgroundColor: '#f9fafb',
                          borderRadius: '6px',
                          border: `2px solid ${item.fill}`,
                          minHeight: '50px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <div style={{
                              width: '16px',
                              height: '16px',
                              backgroundColor: item.fill,
                              borderRadius: '50%',
                              marginRight: '12px',
                              flexShrink: 0
                            }}></div>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                              {item.name}
                            </div>
                          </div>
                          <div style={{ 
                            fontSize: '16px', 
                            fontWeight: 'bold', 
                            color: '#111827',
                            textAlign: 'right'
                          }}>
                            <div>{item.value}台</div>
                            <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 'normal' }}>
                              ({Math.round((item.value / filteredData.length) * 100)}%)
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 価格推移 */}
            {viewMode === 'trend' && (
              <div style={{ 
                backgroundColor: 'white', 
                borderRadius: '8px', 
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', 
                border: '1px solid #e5e7eb', 
                padding: '24px' 
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  marginBottom: '16px' 
                }}>
                  <h3 style={{ 
                    fontSize: '18px', 
                    fontWeight: '600', 
                    color: '#111827' 
                  }}>
                    価格推移
                  </h3>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {/* 日付基準切り替え */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={() => setTrendDateMode('scraping')}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          border: 'none',
                          cursor: 'pointer',
                          backgroundColor: trendDateMode === 'scraping' ? '#10b981' : '#f3f4f6',
                          color: trendDateMode === 'scraping' ? 'white' : '#374751'
                        }}
                      >
                        取得日基準
                      </button>
                      <button
                        onClick={() => setTrendDateMode('year')}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          border: 'none',
                          cursor: 'pointer',
                          backgroundColor: trendDateMode === 'year' ? '#10b981' : '#f3f4f6',
                          color: trendDateMode === 'year' ? 'white' : '#374751'
                        }}
                      >
                        年式基準
                      </button>
                    </div>
                    
                    {/* 時間軸切り替え（スクレイピング日基準の場合のみ） */}
                    {trendDateMode === 'scraping' && (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {['daily', 'monthly', 'yearly'].map(scale => (
                          <button
                            key={scale}
                            onClick={() => setTimeScale(scale)}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              border: 'none',
                              cursor: 'pointer',
                              backgroundColor: timeScale === scale ? '#3b82f6' : '#f3f4f6',
                              color: timeScale === scale ? 'white' : '#374751'
                            }}
                          >
                            {scale === 'daily'
                              ? '日次'
                              : scale === 'monthly'
                              ? '月次'
                              : '年次'}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={trendDateMode === 'scraping' ? trendDataWithForecast : trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" stroke="#666" />
                    <YAxis label={{ value: '価格 (万円)', angle: -90, position: 'insideLeft' }} stroke="#666" />
                    <Tooltip 
                      formatter={(value, name) => [`${value}万円`, name]}
                      labelFormatter={(label) => `期間: ${label}`}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="avgPrice" 
                      stroke="#3b82f6" 
                      strokeWidth={3}
                      name="平均価格"
                      dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="median" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      name="中央値"
                      strokeDasharray="5 5"
                      dot={false}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="maxPrice" 
                      stroke="#ef4444" 
                      strokeWidth={1}
                      name="最高価格"
                      strokeDasharray="2 2"
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="minPrice"
                      stroke="#f59e0b"
                      strokeWidth={1}
                      name="最低価格"
                      strokeDasharray="2 2"
                      dot={false}
                    />
                    {trendDateMode === 'scraping' && (
                      <Line
                        type="monotone"
                        dataKey="forecastPrice"
                        stroke="#6366f1"
                        strokeWidth={2}
                        name="予想平均価格"
                        strokeDasharray="3 3"
                        dot={{ stroke: '#6366f1', fill: '#fff', r: 3 }}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
                <div style={{ marginTop: '16px', fontSize: '14px', color: '#6b7280' }}>
                  <p>💡 {trendDateMode === 'scraping' ? 'スクレイピング取得日' : '年式'}を基準とした価格推移です</p>
                  <p>
                    📈 青線：平均価格、緑破線：中央値、赤破線：最高価格、橙破線：最低価格
                    {trendDateMode === 'scraping' && '、紫破線：予想平均価格'}
                  </p>
                </div>
              </div>
            )}

            {/* グレード分析 */}
            {viewMode === 'grades' && (
              <div style={{ 
                backgroundColor: 'white', 
                borderRadius: '8px', 
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', 
                border: '1px solid #e5e7eb', 
                padding: '24px' 
              }}>
                <h3 style={{ 
                  fontSize: '18px', 
                  fontWeight: '600', 
                  color: '#111827', 
                  marginBottom: '16px' 
                }}>
                  グレード別価格分析
                </h3>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={gradeAnalysisData} margin={{ bottom: 100 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="grade" 
                      angle={-45} 
                      textAnchor="end" 
                      height={100} 
                      stroke="#666"
                      interval={0}
                    />
                    <YAxis label={{ value: '価格 (万円)', angle: -90, position: 'insideLeft' }} stroke="#666" />
                    <Tooltip 
                      formatter={(value, name) => [`${value}万円`, name]}
                      labelFormatter={(label) => {
                        const item = gradeAnalysisData.find(d => d.grade === label);
                        return item ? item.fullGrade : label;
                      }}
                    />
                    <Legend />
                    <Bar dataKey="avgPrice" fill="#3b82f6" name="平均価格" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="median" fill="#10b981" name="中央値" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                
                {/* グレード別統計テーブル */}
                <div style={{ marginTop: '24px' }}>
                  <h4 style={{ 
                    fontSize: '16px', 
                    fontWeight: '600', 
                    color: '#111827', 
                    marginBottom: '12px' 
                  }}>
                    グレード別詳細データ
                  </h4>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ 
                      width: '100%', 
                      borderCollapse: 'collapse', 
                      border: '1px solid #d1d5db' 
                    }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f9fafb' }}>
                          <th style={{ 
                            border: '1px solid #d1d5db', 
                            padding: '8px 16px', 
                            textAlign: 'left',
                            fontSize: '14px',
                            fontWeight: '600'
                          }}>
                            グレード
                          </th>
                          <th style={{ 
                            border: '1px solid #d1d5db', 
                            padding: '8px 16px', 
                            textAlign: 'left',
                            fontSize: '14px',
                            fontWeight: '600'
                          }}>
                            台数
                          </th>
                          <th style={{ 
                            border: '1px solid #d1d5db', 
                            padding: '8px 16px', 
                            textAlign: 'left',
                            fontSize: '14px',
                            fontWeight: '600'
                          }}>
                            平均価格
                          </th>
                          <th style={{ 
                            border: '1px solid #d1d5db', 
                            padding: '8px 16px', 
                            textAlign: 'left',
                            fontSize: '14px',
                            fontWeight: '600'
                          }}>
                            価格範囲
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {availableGrades.slice(0, 10).map((grade, index) => {
                          const gradeData = filteredData.filter(item => 
                            (showNormalizedGrades ? item.正規グレード : item.元グレード) === grade
                          );
                          const avgPrice = gradeData.length > 0 
                            ? Math.round(gradeData.reduce((sum, item) => sum + item.price, 0) / gradeData.length * 10) / 10
                            : 0;
                          const minPrice = gradeData.length > 0 ? Math.min(...gradeData.map(item => item.price)) : 0;
                          const maxPrice = gradeData.length > 0 ? Math.max(...gradeData.map(item => item.price)) : 0;
                          
                          return (
                            <tr key={index} style={{ 
                              backgroundColor: index % 2 === 0 ? 'white' : '#f9fafb' 
                            }}>
                              <td style={{ 
                                border: '1px solid #d1d5db', 
                                padding: '8px 16px',
                                fontSize: '14px'
                              }}>
                                {grade}
                              </td>
                              <td style={{ 
                                border: '1px solid #d1d5db', 
                                padding: '8px 16px',
                                fontSize: '14px'
                              }}>
                                {gradeData.length}台
                              </td>
                              <td style={{ 
                                border: '1px solid #d1d5db', 
                                padding: '8px 16px',
                                fontSize: '14px',
                                fontWeight: '600',
                                color: '#3b82f6'
                              }}>
                                {avgPrice}万円
                              </td>
                              <td style={{ 
                                border: '1px solid #d1d5db', 
                                padding: '8px 16px',
                                fontSize: '14px'
                              }}>
                                {minPrice}〜{maxPrice}万円
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 走行距離vs価格 */}
            {viewMode === 'scatter' && (
              <div style={{ 
                backgroundColor: 'white', 
                borderRadius: '8px', 
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', 
                border: '1px solid #e5e7eb', 
                padding: '24px' 
              }}>
                <h3 style={{ 
                  fontSize: '18px', 
                  fontWeight: '600', 
                  color: '#111827', 
                  marginBottom: '16px' 
                }}>
                  走行距離 vs 価格
                </h3>
                <ResponsiveContainer width="100%" height={400}>
                  <ScatterChart data={filteredData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      type="number" 
                      dataKey="mileage" 
                      name="走行距離"
                      label={{ value: '走行距離 (km)', position: 'insideBottom', offset: -5 }}
                      stroke="#666"
                    />
                    <YAxis 
                      type="number" 
                      dataKey="price" 
                      name="価格"
                      label={{ value: '価格 (万円)', angle: -90, position: 'insideLeft' }}
                      stroke="#666"
                    />
                    <Tooltip
                      cursor={{ strokeDasharray: '3 3' }}
                      wrapperStyle={{ pointerEvents: 'auto' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length > 0) {
                          const data = payload[0].payload;
                          return (
                            <div style={{
                              backgroundColor: 'white',
                              border: '1px solid #d1d5db',
                              borderRadius: '6px',
                              padding: '12px',
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                            }}>
                              <p style={{ fontSize: '14px', margin: '0 0 4px 0' }}>
                                <strong>価格:</strong> {data.price}万円
                              </p>
                              <p style={{ fontSize: '14px', margin: '0 0 4px 0' }}>
                                <strong>走行距離:</strong> {Math.round(data.mileage / 10000 * 10) / 10}万km
                              </p>
                              <p style={{ fontSize: '14px', margin: '0 0 4px 0' }}>
                                <strong>年式:</strong> {data.year}年
                              </p>
                              <p style={{ fontSize: '14px', margin: '0 0 4px 0' }}>
                                <strong>グレード:</strong> {data.正規グレード}
                              </p>
                              <p style={{ fontSize: '14px', margin: '0 0 4px 0' }}>
                                <strong>修復歴:</strong> {data.修復歴}
                              </p>
                              <p style={{ fontSize: '14px', margin: '0' }}>
                                <strong>詳細を見る:</strong> 
                                <a 
                                  href={data.車両URL || data.ソースURL} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  style={{ 
                                    color: '#3b82f6', 
                                    textDecoration: 'none',
                                    marginLeft: '8px'
                                  }}
                                >
                                  カーセンサーで確認
                                </a>
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Scatter 
                      dataKey="price" 
                      fill="#3b82f6"
                      onClick={(data, index) => {
                        if (data && data.payload) {
                          handleCarClick(data.payload);
                        }
                      }}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
                <div style={{ marginTop: '16px', fontSize: '14px', color: '#6b7280' }}>
                  <p>💡 <strong>ヒント:</strong> 各点は1台の車両を表しています。左下ほど高コスパ、右上ほど価格が高い傾向があります。</p>
                  <p>🖱️ <strong>操作:</strong> 点をクリックすると車両の詳細情報が表示されます。</p>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* 車両詳細モーダル */}
      {showCarDetailModal && selectedCarDetail && (
        <div 
          style={{
            position: 'fixed',
            inset: '0',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: '50'
          }}
          onClick={() => setShowCarDetailModal(false)}
        >
          <div 
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
              width: '90%',
              maxWidth: '500px',
              maxHeight: '80vh',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '24px',
              borderBottom: '1px solid #e5e7eb'
            }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#111827',
                margin: '0'
              }}>
                車両詳細情報
              </h3>
              <button 
                style={{
                  color: '#6b7280',
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '0',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onClick={() => setShowCarDetailModal(false)}
              >
                ×
              </button>
            </div>
            
            <div style={{ padding: '24px', overflowY: 'auto', maxHeight: '60vh' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '14px', fontWeight: '500', color: '#374751' }}>価格</label>
                  <div style={{ 
                    fontSize: '24px', 
                    fontWeight: 'bold', 
                    color: '#3b82f6',
                    marginBottom: '16px'
                  }}>
                    {selectedCarDetail.price}万円
                  </div>
                </div>
                
                <div>
                  <label style={{ fontSize: '14px', fontWeight: '500', color: '#374751' }}>年式</label>
                  <div style={{ 
                    fontSize: '18px', 
                    fontWeight: '600',
                    marginBottom: '16px'
                  }}>
                    {selectedCarDetail.year}年
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '14px', fontWeight: '500', color: '#374751' }}>走行距離</label>
                  <div style={{ 
                    fontSize: '18px', 
                    fontWeight: '600',
                    marginBottom: '16px'
                  }}>
                    {Math.round(selectedCarDetail.mileage / 10000 * 10) / 10}万km
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '14px', fontWeight: '500', color: '#374751' }}>修復歴</label>
                  <div style={{ 
                    fontSize: '18px', 
                    fontWeight: '600',
                    color: selectedCarDetail.修復歴 === 'なし' ? '#10b981' : '#ef4444',
                    marginBottom: '16px'
                  }}>
                    {selectedCarDetail.修復歴}
                  </div>
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '14px', fontWeight: '500', color: '#374751' }}>グレード</label>
                  <div style={{ 
                    fontSize: '16px', 
                    fontWeight: '600',
                    marginBottom: '16px'
                  }}>
                    {selectedCarDetail.正規グレード}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '14px', fontWeight: '500', color: '#374751' }}>ミッション</label>
                  <div style={{ 
                    fontSize: '14px',
                    marginBottom: '16px'
                  }}>
                    {selectedCarDetail.ミッション}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '14px', fontWeight: '500', color: '#374751' }}>排気量</label>
                  <div style={{ 
                    fontSize: '14px',
                    marginBottom: '16px'
                  }}>
                    {selectedCarDetail.排気量}
                  </div>
                </div>

                {selectedCarDetail.マッチング精度 && (
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontSize: '14px', fontWeight: '500', color: '#374751' }}>マッチング精度</label>
                    <div style={{ 
                      fontSize: '14px',
                      marginBottom: '16px'
                    }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '600',
                        backgroundColor: selectedCarDetail.マッチング精度 >= 0.9 ? '#dcfce7' : '#fef3c7',
                        color: selectedCarDetail.マッチング精度 >= 0.9 ? '#166534' : '#92400e'
                      }}>
                        {Math.round(selectedCarDetail.マッチング精度 * 100)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* コスパ指標 */}
              <div style={{
                marginTop: '24px',
                padding: '16px',
                backgroundColor: '#f9fafb',
                borderRadius: '6px'
              }}>
                <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>コスパ指標</h4>
                <div style={{ fontSize: '14px', color: '#6b7280' }}>
                  <div>年間走行距離: {selectedCarDetail.mileagePerYear ? Math.round(selectedCarDetail.mileagePerYear) : 'N/A'}km</div>
                  <div>車両年数: {new Date().getFullYear() - selectedCarDetail.year}年</div>
                </div>
              </div>

              {/* カーセンサー詳細リンク */}
              {(selectedCarDetail.車両URL || selectedCarDetail.ソースURL) && (
                <div style={{
                  marginTop: '16px',
                  padding: '16px',
                  backgroundColor: '#f0f9ff',
                  borderRadius: '6px',
                  border: '1px solid #0ea5e9'
                }}>
                  <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px', color: '#0c4a6e' }}>
                    詳細情報
                  </h4>
                  <div style={{ fontSize: '14px' }}>
                    <a 
                      href={selectedCarDetail.車両URL || selectedCarDetail.ソースURL} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: '#0ea5e9',
                        textDecoration: 'none',
                        fontWeight: '500',
                        padding: '8px 16px',
                        backgroundColor: 'white',
                        borderRadius: '6px',
                        border: '1px solid #0ea5e9'
                      }}
                    >
                      🔗 カーセンサーで詳細を見る
                    </a>
                    {selectedCarDetail.車両URL && (
                      <div style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280' }}>
                        個別車両ページ: {selectedCarDetail.車両URL}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          cursor: pointer;
          pointer-events: auto;
        }

        input[type="range"]:focus {
          outline: 2px solid #3b82f6;
          outline-offset: 2px;
        }

        input[type="range"]::-webkit-slider-track {
          background: transparent;
          height: 8px;
          border-radius: 4px;
        }

        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          background: #3b82f6;
          height: 24px;
          width: 24px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          cursor: pointer;
          pointer-events: auto;
          transition: all 0.2s ease;
        }

        input[type="range"]::-webkit-slider-thumb:hover {
          background: #2563eb;
          transform: scale(1.1);
        }

        input[type="range"]::-moz-range-track {
          background: transparent;
          height: 8px;
          border-radius: 4px;
          border: none;
        }

        input[type="range"]::-moz-range-thumb {
          background: #3b82f6;
          height: 24px;
          width: 24px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          cursor: pointer;
          pointer-events: auto;
          transition: all 0.2s ease;
        }

        input[type="range"]::-moz-range-thumb:hover {
          background: #2563eb;
          transform: scale(1.1);
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}