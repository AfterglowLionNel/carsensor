import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ScatterChart, Scatter, ResponsiveContainer, BarChart, Bar } from 'recharts';
import Papa from 'papaparse';
import React from 'react';

export default function CarAnalysisApp() {
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('trend');
  const [timeScale, setTimeScale] = useState('monthly');
  const [selectedFile, setSelectedFile] = useState('');
  const [availableFiles, setAvailableFiles] = useState([]);
  const [selectedDataPoints, setSelectedDataPoints] = useState([]);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  // フィルター状態
  const [filters, setFilters] = useState({
    grades: [],
    yearMin: 2020,
    yearMax: 2025,
    mileageMax: 100000,
    repairHistory: 'all',
    transmission: 'all',
    displacement: 'all',
    useNormalizedGrades: true
  });

  // データクレンジング関数
  const parsePrice = (priceStr) => {
    if (!priceStr) return null;
    const match = priceStr.match(/([0-9.]+)万円/);
    return match ? parseFloat(match[1]) : null;
  };

  const parseYear = (yearStr) => {
    if (!yearStr) return null;
    const match = yearStr.match(/(\d{4})/);
    return match ? parseInt(match[1]) : null;
  };

  const parseMileage = (mileageStr) => {
    if (!mileageStr) return null;
    if (mileageStr.includes('万km')) {
      const match = mileageStr.match(/([0-9.]+)万km/);
      return match ? parseFloat(match[1]) * 10000 : null;
    } else {
      const match = mileageStr.match(/([0-9.]+)km/);
      return match ? parseFloat(match[1]) : null;
    }
  };

  // 利用可能ファイル一覧の取得
  useEffect(() => {
    const loadAvailableFiles = async () => {
      try {
        // 正規化済みファイルを検索
        const normalizedFiles = [];
        
        // data/normalizedディレクトリの構造を想定
        const commonCarNames = ['GRヤリス', 'レヴォーグ', 'N-BOX', 'アルファード', 'プリウス', 'RC F'];
        
        for (const carName of commonCarNames) {
          try {
            const response = await fetch(`/data/normalized/${carName}_normalized_latest.xlsx`);
            if (response.ok) {
              normalizedFiles.push(`${carName}_normalized_latest.xlsx`);
            }
          } catch (error) {
            console.log(`${carName} のファイルが見つかりません`);
          }
        }
        
        // CSVファイルも検索
        const csvFiles = ['sample_data.csv', 'latest_analysis.csv'];
        for (const csvFile of csvFiles) {
          try {
            const response = await fetch(`/data/${csvFile}`);
            if (response.ok) {
              normalizedFiles.push(csvFile);
            }
          } catch (error) {
            console.log(`${csvFile} が見つかりません`);
          }
        }
        
        setAvailableFiles(normalizedFiles);
        if (normalizedFiles.length > 0) {
          setSelectedFile(normalizedFiles[0]);
        }
      } catch (error) {
        console.error('ファイル一覧取得エラー:', error);
        // フォールバック: デフォルトファイル
        setAvailableFiles(['sample_data.csv']);
        setSelectedFile('sample_data.csv');
      }
    };
    
    loadAvailableFiles();
  }, []);

  // データ読み込み
  useEffect(() => {
    if (!selectedFile) return;
    
    const loadData = async () => {
      try {
        setLoading(true);
        
        let fileContent;
        if (selectedFile.endsWith('.xlsx')) {
          // Excelファイルの場合、CSVに変換されたものを読み込み
          const csvFile = selectedFile.replace('.xlsx', '.csv');
          const response = await fetch(`/data/${csvFile}`);
          fileContent = await response.text();
        } else {
          const response = await fetch(`/data/${selectedFile}`);
          fileContent = await response.text();
        }
        
        const parsed = Papa.parse(fileContent, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          delimitersToGuess: [',', '\t', '|', ';']
        });

        const cleanedData = parsed.data.map((row, index) => {
          const price = parsePrice(row.支払総額);
          const year = parseYear(row.年式);
          const mileage = parseMileage(row.走行距離);
          const carName = row.車種名 || 'Unknown';
          
          // 正規グレードがある場合はそれを使用、なければ元グレード
          const originalGrade = row.グレード || row.元グレード || '';
          const normalizedGrade = row.正規グレード || originalGrade;
          
          return {
            id: index,
            price,
            year,
            mileage,
            originalGrade,
            normalizedGrade,
            carName,
            repairHistory: row.修復歴,
            transmission: row.ミッション,
            displacement: row.排気量,
            matchingScore: row.マッチング精度 || 0,
            date: row.取得日時 || `2024-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`
          };
        }).filter(row => row.price && row.year && row.mileage !== null);

        setRawData(cleanedData);
        
        // 正規化されたグレードでフィルター初期化
        const uniqueGrades = [...new Set(cleanedData.map(item => 
          filters.useNormalizedGrades ? item.normalizedGrade : item.originalGrade
        ))].filter(g => g);
        
        setFilters(prev => ({
          ...prev,
          grades: uniqueGrades
        }));
        
        setLoading(false);
      } catch (error) {
        console.error('データ読み込みエラー:', error);
        setLoading(false);
      }
    };

    loadData();
  }, [selectedFile]);

  // フィルター適用後のデータ
  const filteredData = useMemo(() => {
    return rawData.filter(item => {
      const targetGrade = filters.useNormalizedGrades ? item.normalizedGrade : item.originalGrade;
      
      if (filters.grades.length > 0 && !filters.grades.includes(targetGrade)) return false;
      if (item.year < filters.yearMin || item.year > filters.yearMax) return false;
      if (item.mileage > filters.mileageMax) return false;
      if (filters.repairHistory === 'none' && item.repairHistory !== 'なし') return false;
      if (filters.repairHistory === 'exists' && item.repairHistory !== 'あり') return false;
      if (filters.transmission !== 'all' && item.transmission !== filters.transmission) return false;
      if (filters.displacement !== 'all' && item.displacement !== filters.displacement) return false;
      return true;
    });
  }, [rawData, filters]);

  // 価格推移データの生成
  const trendData = useMemo(() => {
    if (filteredData.length === 0) return [];
    
    const grouped = {};
    filteredData.forEach(item => {
      let key;
      if (timeScale === 'daily') {
        key = item.date;
      } else if (timeScale === 'monthly') {
        key = item.date.substring(0, 7);
      } else {
        key = item.year.toString();
      }
      
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(item);
    });

    return Object.entries(grouped)
      .map(([key, items]) => {
        const prices = items.map(item => item.price);
        return {
          date: key,
          avgPrice: prices.reduce((sum, price) => sum + price, 0) / prices.length,
          count: prices.length,
          items: items
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredData, timeScale]);

  // グレード別分析データ
  const gradeAnalysisData = useMemo(() => {
    if (filteredData.length === 0) return [];
    
    const gradeStats = {};
    filteredData.forEach(item => {
      const grade = filters.useNormalizedGrades ? item.normalizedGrade : item.originalGrade;
      if (!gradeStats[grade]) {
        gradeStats[grade] = {
          prices: [],
          count: 0,
          matchingScores: []
        };
      }
      gradeStats[grade].prices.push(item.price);
      gradeStats[grade].count++;
      gradeStats[grade].matchingScores.push(item.matchingScore);
    });

    return Object.entries(gradeStats)
      .map(([grade, stats]) => ({
        grade,
        avgPrice: stats.prices.reduce((sum, price) => sum + price, 0) / stats.prices.length,
        minPrice: Math.min(...stats.prices),
        maxPrice: Math.max(...stats.prices),
        count: stats.count,
        avgMatchingScore: stats.matchingScores.reduce((sum, score) => sum + score, 0) / stats.matchingScores.length
      }))
      .sort((a, b) => b.avgPrice - a.avgPrice);
  }, [filteredData, filters.useNormalizedGrades]);

  // コスパ分析用データ
  const cospaData = useMemo(() => {
    if (filteredData.length === 0) return [];
    
    return filteredData.map(item => {
      // 簡単な相場計算（年式と走行距離から）
      const basePrice = 400; // 基準価格
      const yearFactor = Math.max(0.5, 1 - ((2025 - item.year) * 0.1));
      const mileageFactor = Math.max(0.5, 1 - (item.mileage / 100000) * 0.3);
      const expectedPrice = basePrice * yearFactor * mileageFactor;
      const costPerformance = expectedPrice - item.price;
      
      return {
        ...item,
        expectedPrice,
        costPerformance,
        isGoodDeal: costPerformance > 20
      };
    });
  }, [filteredData]);

  // フィルター更新関数
  const updateFilter = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // グラフクリック処理
  const handleChartClick = (data) => {
    if (data && data.activePayload && data.activePayload[0]) {
      const clickedData = data.activePayload[0].payload;
      if (clickedData.items) {
        setSelectedDataPoints(clickedData.items);
        setShowDetailModal(true);
      }
    }
  };

  // グレード表示切り替え時の処理
  const handleGradeTypeChange = (useNormalized) => {
    setFilters(prev => {
      const uniqueGrades = [...new Set(rawData.map(item => 
        useNormalized ? item.normalizedGrade : item.originalGrade
      ))].filter(g => g);
      
      return {
        ...prev,
        useNormalizedGrades: useNormalized,
        grades: uniqueGrades
      };
    });
  };

  const uniqueGrades = useMemo(() => {
    return [...new Set(rawData.map(item => 
      filters.useNormalizedGrades ? item.normalizedGrade : item.originalGrade
    ))].filter(g => g).sort();
  }, [rawData, filters.useNormalizedGrades]);

  const uniqueTransmissions = useMemo(() => {
    return [...new Set(rawData.map(item => item.transmission))].filter(t => t).sort();
  }, [rawData]);

  const uniqueDisplacements = useMemo(() => {
    return [...new Set(rawData.map(item => item.displacement))].filter(d => d).sort();
  }, [rawData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <div className="text-xl font-semibold text-gray-700 mb-4">データを読み込み中...</div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* 左側フィルターパネル */}
      <div className="w-80 bg-white shadow-lg overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4 text-gray-800">分析設定</h2>
          
          {/* ファイル選択 */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2 text-gray-700">データファイル</label>
            <select
              value={selectedFile}
              onChange={(e) => setSelectedFile(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {availableFiles.map(file => (
                <option key={file} value={file}>{file}</option>
              ))}
            </select>
          </div>

          {/* グレード表示切り替え */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2 text-gray-700">グレード表示</label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={filters.useNormalizedGrades}
                  onChange={() => handleGradeTypeChange(true)}
                  className="mr-2 text-blue-600"
                />
                <span className="text-sm">正規グレード</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={!filters.useNormalizedGrades}
                  onChange={() => handleGradeTypeChange(false)}
                  className="mr-2 text-blue-600"
                />
                <span className="text-sm">元グレード</span>
              </label>
            </div>
          </div>
          
          {/* グレード選択 */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2 text-gray-700">
              {filters.useNormalizedGrades ? '正規グレード' : '元グレード'}
            </label>
            <div className="max-h-32 overflow-y-auto border border-gray-300 rounded-md p-2 bg-gray-50">
              {uniqueGrades.map(grade => (
                <label key={grade} className="flex items-center mb-1 hover:bg-gray-100 p-1 rounded">
                  <input
                    type="checkbox"
                    checked={filters.grades.includes(grade)}
                    onChange={(e) => {
                      const newGrades = e.target.checked
                        ? [...filters.grades, grade]
                        : filters.grades.filter(g => g !== grade);
                      updateFilter('grades', newGrades);
                    }}
                    className="mr-2 text-blue-600"
                  />
                  <span className="text-sm text-gray-700">{grade}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 年式範囲 */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2 text-gray-700">年式範囲</label>
            <div className="flex space-x-2">
              <input
                type="number"
                value={filters.yearMin}
                onChange={(e) => updateFilter('yearMin', parseInt(e.target.value))}
                min="2020"
                max="2025"
                className="w-20 border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="self-center text-gray-500">〜</span>
              <input
                type="number"
                value={filters.yearMax}
                onChange={(e) => updateFilter('yearMax', parseInt(e.target.value))}
                min="2020"
                max="2025"
                className="w-20 border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* 走行距離 */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2 text-gray-700">
              走行距離上限: {(filters.mileageMax / 10000).toFixed(1)}万km
            </label>
            <input
              type="range"
              min="0"
              max="100000"
              step="5000"
              value={filters.mileageMax}
              onChange={(e) => updateFilter('mileageMax', parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-md">
            表示中: <span className="font-semibold">{filteredData.length}</span>件 / 
            全<span className="font-semibold">{rawData.length}</span>件
          </div>
        </div>
      </div>

      {/* 右側メインエリア */}
      <div className="flex-1 p-6">
        <div className="bg-white rounded-lg shadow-lg h-full">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-800">中古車価格分析（正規グレード対応）</h1>
              
              <div className="flex space-x-4">
                <div className="flex space-x-2">
                  <button
                    onClick={() => setViewMode('trend')}
                    className={`px-4 py-2 rounded-md transition-colors ${
                      viewMode === 'trend' 
                        ? 'bg-blue-500 text-white shadow-md' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    価格推移
                  </button>
                  <button
                    onClick={() => setViewMode('grades')}
                    className={`px-4 py-2 rounded-md transition-colors ${
                      viewMode === 'grades' 
                        ? 'bg-blue-500 text-white shadow-md' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    グレード分析
                  </button>
                  <button
                    onClick={() => setViewMode('cospa')}
                    className={`px-4 py-2 rounded-md transition-colors ${
                      viewMode === 'cospa' 
                        ? 'bg-blue-500 text-white shadow-md' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    コスパ分析
                  </button>
                </div>

                {viewMode === 'trend' && (
                  <div className="flex space-x-2">
                    {['daily', 'monthly', 'yearly'].map(scale => (
                      <button
                        key={scale}
                        onClick={() => setTimeScale(scale)}
                        className={`px-3 py-1 rounded-md text-sm transition-colors ${
                          timeScale === scale
                            ? 'bg-green-500 text-white shadow-md'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {scale === 'daily' ? '日次' : scale === 'monthly' ? '月次' : '年次'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* グラフエリア */}
            <div className="h-96 mb-6 bg-gray-50 rounded-lg p-4">
              {viewMode === 'trend' ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} onClick={handleChartClick}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis dataKey="date" stroke="#666" />
                    <YAxis label={{ value: '価格 (万円)', angle: -90, position: 'insideLeft' }} stroke="#666" />
                    <Tooltip 
                      formatter={(value, name) => [`${value.toFixed(1)}万円`, '平均価格']}
                      labelFormatter={(label) => `日付: ${label}`}
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="avgPrice" 
                      stroke="#2563eb" 
                      strokeWidth={3}
                      name="平均価格"
                      dot={{ fill: '#2563eb', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, stroke: '#2563eb', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : viewMode === 'grades' ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gradeAnalysisData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis dataKey="grade" angle={-45} textAnchor="end" height={100} stroke="#666" />
                    <YAxis label={{ value: '価格 (万円)', angle: -90, position: 'insideLeft' }} stroke="#666" />
                    <Tooltip 
                      formatter={(value, name) => [`${value.toFixed(1)}万円`, name]}
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
                    />
                    <Legend />
                    <Bar dataKey="avgPrice" fill="#3b82f6" name="平均価格" />
                    <Bar dataKey="minPrice" fill="#10b981" name="最安価格" />
                    <Bar dataKey="maxPrice" fill="#ef4444" name="最高価格" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart data={cospaData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
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
                      content={({ active, payload }) => {
                        if (active && payload && payload.length > 0) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-yellow-100 border border-yellow-400 rounded-lg p-3 shadow-lg">
                              <p className="text-sm"><strong>価格:</strong> {data.price}万円</p>
                              <p className="text-sm"><strong>走行距離:</strong> {data.mileage.toLocaleString()}km</p>
                              <p className="text-sm"><strong>年式:</strong> {data.year}年</p>
                              <p className="text-sm"><strong>グレード:</strong> {data.normalizedGrade}</p>
                              <p className="text-sm">
                                <strong>コスパ:</strong> 
                                <span className={data.isGoodDeal ? 'text-blue-600 font-semibold' : 'text-red-600 font-semibold'}>
                                  {data.isGoodDeal ? ' お買い得' : ' 割高'}
                                </span>
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Scatter 
                      data={cospaData} 
                      fill="#3b82f6"
                    >
                      {cospaData.map((entry, index) => (
                        <circle
                          key={index}
                          fill={entry.isGoodDeal ? '#3b82f6' : '#ef4444'}
                          r={4}
                        />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* 統計情報 */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="text-sm text-blue-600 font-medium">平均価格</div>
                <div className="text-xl font-bold text-blue-800">
                  {filteredData.length > 0 
                    ? `${(filteredData.reduce((sum, item) => sum + item.price, 0) / filteredData.length).toFixed(1)}万円`
                    : '-'
                  }
                </div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <div className="text-sm text-green-600 font-medium">グレード数</div>
                <div className="text-xl font-bold text-green-800">
                  {uniqueGrades.length}種類
                </div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                <div className="text-sm text-purple-600 font-medium">
                  {filters.useNormalizedGrades ? '正規化精度' : '対象データ'}
                </div>
                <div className="text-xl font-bold text-purple-800">
                  {filters.useNormalizedGrades 
                    ? `${((filteredData.reduce((sum, item) => sum + item.matchingScore, 0) / filteredData.length) * 100).toFixed(1)}%`
                    : `${filteredData.length}件`
                  }
                </div>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                <div className="text-sm text-orange-600 font-medium">データソース</div>
                <div className="text-xl font-bold text-orange-800">
                  {selectedFile.split('_')[0] || selectedFile.split('.')[0]}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 詳細モーダル */}
      {showDetailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowDetailModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-11/12 max-w-4xl max-h-5/6 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">詳細データ ({selectedDataPoints.length}件)</h3>
              <button 
                className="text-gray-400 hover:text-gray-600 transition-colors"
                onClick={() => setShowDetailModal(false)}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-auto max-h-96">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-300 px-4 py-2 text-left">価格</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">年式</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">走行距離</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">正規グレード</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">修復歴</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">ミッション</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDataPoints.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-4 py-2">{item.price}万円</td>
                        <td className="border border-gray-300 px-4 py-2">{item.year}年</td>
                        <td className="border border-gray-300 px-4 py-2">{item.mileage.toLocaleString()}km</td>
                        <td className="border border-gray-300 px-4 py-2">{item.normalizedGrade}</td>
                        <td className="border border-gray-300 px-4 py-2">{item.repairHistory}</td>
                        <td className="border border-gray-300 px-4 py-2">{item.transmission}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}