'use client';
import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import dynamic from 'next/dynamic';
import Uploader from '../components/Uploader';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

// 1. KOMPONEN DROPDOWN DENGAN SEARCH & CLEAR
const SearchableSelect = ({ label, options, value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => 
    String(opt.label || opt).toLowerCase().includes(search.toLowerCase())
  );
  const activeLabel = options.find(opt => (opt.value || opt) === value)?.label || value;

  return (
    <div className="flex flex-col w-40 relative" ref={wrapperRef}>
      <label className="text-gray-500 mb-1 truncate font-semibold text-[10px]" title={label}>{label}</label>
      <div 
        className="border px-2 py-1.5 rounded outline-none focus:border-blue-400 bg-white cursor-pointer flex justify-between items-center text-[10px] shadow-sm hover:border-blue-300 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate flex-1 pr-1">{activeLabel}</span>
        {value !== 'All' ? (
          <button 
            onClick={(e) => { e.stopPropagation(); onChange('All'); }} 
            className="text-red-400 hover:text-red-600 font-bold ml-1 px-1"
            title="Clear filter"
          >✕</button>
        ) : (
          <span className="text-gray-400 text-[8px] ml-1">▼</span>
        )}
      </div>
      
      {isOpen && (
        <div className="absolute top-full left-0 w-64 mt-1 bg-white border border-gray-200 rounded shadow-xl z-50">
          <div className="p-1.5 border-b bg-gray-50 rounded-t">
            <input 
              type="text" 
              className="w-full px-2 py-1 text-[10px] outline-none border rounded" 
              placeholder={`Cari ${label}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>
          <ul className="max-h-48 overflow-y-auto">
            {filteredOptions.length > 0 ? filteredOptions.map(opt => {
              const optVal = opt.value || opt;
              const optLabel = opt.label || opt;
              return (
                <li 
                  key={optVal} 
                  className="px-3 py-1.5 hover:bg-blue-50 cursor-pointer text-[10px] border-b border-gray-50 last:border-0 truncate"
                  onClick={() => { onChange(optVal); setIsOpen(false); setSearch(''); }}
                  title={optLabel}
                >
                  {optLabel}
                </li>
              );
            }) : (
              <li className="px-3 py-2 text-[10px] text-gray-400 italic">Tidak ditemukan</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

// 2. KOMPONEN CONTRIBUTOR DENGAN HOVER POPUP FULL DATA
const ContributorList = ({ title, data, dataKey, dapotMaster, chartDataLength }) => {
  return (
    <div className="w-48 bg-white p-3 border-l border-gray-100 flex flex-col z-10 relative">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[11px] font-bold text-gray-700 flex items-center">
          <span className="text-rose-600 mr-2 text-lg leading-none">•</span> {title}
        </h4>
      </div>
      <div className="flex-1 overflow-y-auto pr-1">
        {data.map((item, idx) => {
          const val = Number(item[dataKey]) || 0;
          const siteMeta = dapotMaster.find(d => d.site_id === item.site_id) || {};
          
          // Kalkulasi Total Outage otomatis
          const lossPercentage = (100 - val) / 100;
          const totalOutageHrs = (lossPercentage * 24 * (chartDataLength || 1)).toFixed(2);

          return (
            <div key={idx} className="flex items-center text-[10px] mb-1.5 relative group cursor-help">
              <span className="w-12 truncate text-gray-500 font-medium">{item.site_id}</span>
              <div className="flex-1 h-2.5 bg-gray-100 mx-2 relative rounded-sm overflow-hidden">
                <div 
                  className="absolute top-0 right-0 h-full bg-rose-500 rounded-sm" 
                  style={{ width: `${Math.max(0, 100 - val)}%` }} 
                ></div>
              </div>
              <span className="w-8 text-right text-gray-700 font-bold">{val.toFixed(2)}</span>

              {/* TOOLTIP POPUP */}
              <div className="absolute top-0 right-full mr-2 hidden group-hover:flex flex-col bg-white border border-gray-200 shadow-2xl p-3 rounded-lg z-50 w-56 text-[10px] text-gray-600">
                <div className="grid grid-cols-[100px_1fr] gap-x-2 gap-y-1">
                  <div className="text-right font-semibold">Site ID</div><div className="font-bold text-gray-800">{item.site_id}</div>
                  <div className="text-right font-semibold">Avg Ava Power</div><div>{(Number(item.ava_power) || val).toFixed(2)}</div>
                  <div className="text-right font-semibold">Site Name</div><div className="truncate" title={siteMeta.site_name}>{siteMeta.site_name || '-'}</div>
                  <div className="text-right font-semibold">Site Class</div><div>{siteMeta.site_class || '-'}</div>
                  <div className="text-right font-semibold">Power Type</div><div>{siteMeta.power_type || '-'}</div>
                  <div className="text-right font-semibold">Transport Type</div><div>{siteMeta.transport_type || '-'}</div>
                  <div className="text-right font-semibold">Avg Ava Transport</div><div>{(Number(item.ava_transport) || val).toFixed(2)}</div>
                  <div className="text-right font-semibold">Total Outage (Hrs)</div><div className="font-bold text-rose-600">{totalOutageHrs}</div>
                  <div className="text-right font-semibold">Category</div><div>{siteMeta.category || '-'}</div>
                  <div className="text-right font-semibold">Child Total</div><div>{siteMeta.child_total || '-'}</div>
                  <div className="text-right font-semibold">Child Site ID</div><div className="truncate">{siteMeta.child_site_id || '-'}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function Dashboard() {
  const [dapotMaster, setDapotMaster] = useState([]); 
  const [chartData, setChartData] = useState([]);     
  const [loading, setLoading] = useState(false);
  const [dbUpdateRange, setDbUpdateRange] = useState({ start: '-', end: '-' });

  const [filters, setFilters] = useState({
    startDate: '', endDate: '', 
    nop: 'All', site_id: 'All', site_class: 'All', 
    kota_kab: 'All', kecamatan: 'All', link_route: 'All', grid_category_new: 'All'
  });

  const normalizeDate = (rawDate) => {
    if (!rawDate) return null;
    if (!isNaN(rawDate) && Number(rawDate) > 40000) {
      const d = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
      return d.toISOString().split('T')[0];
    }
    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return rawDate;
  };

  // 1. INIT: TARIK MASTER DATA & INFO UPDATE TANGGAL
  useEffect(() => {
    async function loadInitialSetup() {
      // Ambil metadata asli sesuai nama kolom yang lo kasih!
      const { data: dapotData } = await supabase.from('dapot_data')
        .select('site_id, site_name, departemen, site_class, power_type, transport_type, category_type_non_3t, jumlah_site_anakan, site_id_anakan, grid_category_new, kotakab, kecamatan, link_route')
        .limit(100000);
      
      if (dapotData) {
        setDapotMaster(dapotData.map(d => ({
          ...d,
          nop: d.departemen,
          kota_kab: d.kotakab,
          category: d.category_type_non_3t,
          child_total: d.jumlah_site_anakan,
          child_site_id: d.site_id_anakan
        })));
      }

      // Ambil Data Update (Range Tanggal)
      const { data: minDate } = await supabase.from('dashboard_master_view').select('period').not('period', 'is', null).order('period', { ascending: true }).limit(1);
      const { data: maxDate } = await supabase.from('dashboard_master_view').select('period').not('period', 'is', null).order('period', { ascending: false }).limit(1);
      
      if (minDate?.[0] && maxDate?.[0]) {
        const startD = normalizeDate(minDate[0].period);
        const endD = normalizeDate(maxDate[0].period);
        setDbUpdateRange({ start: startD, end: endD });
        setFilters(prev => ({ ...prev, startDate: startD, endDate: endD }));
      }
    }
    loadInitialSetup();
  }, []);

  // 2. FILTER & FETCH GRAFIK
  useEffect(() => {
    async function fetchFilteredChartData() {
      if (!filters.startDate || !filters.endDate) return;

      setLoading(true);
      let query = supabase.from('dashboard_master_view').select('*');

      query = query.gte('period', filters.startDate).lte('period', filters.endDate);
      if (filters.nop !== 'All') query = query.eq('nop', filters.nop);
      if (filters.site_id !== 'All') query = query.eq('site_id', filters.site_id);
      if (filters.site_class !== 'All') query = query.eq('site_class', filters.site_class);
      if (filters.kota_kab !== 'All') query = query.eq('kota_kab', filters.kota_kab);
      if (filters.kecamatan !== 'All') query = query.eq('kecamatan', filters.kecamatan);
      if (filters.link_route !== 'All') query = query.eq('link_route', filters.link_route);
      if (filters.grid_category_new !== 'All') query = query.eq('grid_category_new', filters.grid_category_new);

      const { data } = await query.limit(1000000); 
      
      if (data && data.length > 0) {
        setChartData(data.map(d => ({ ...d, period: normalizeDate(d.period) })).filter(d => d.period));
      } else {
        setChartData([]);
      }
      setLoading(false);
    }
    fetchFilteredChartData();
  }, [filters]);

  const handleFilterChange = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));

  const getCascadingOptions = (targetKey) => {
    const relevantDapot = dapotMaster.filter(d => {
      for (const k in filters) {
        if (k === 'startDate' || k === 'endDate' || k === targetKey) continue;
        if (filters[k] !== 'All' && d[k] !== filters[k]) return false;
      }
      return true;
    });

    if (targetKey === 'site_id') {
      const uniqueSites = [];
      const seen = new Set();
      relevantDapot.forEach(item => {
        if (item.site_id && !seen.has(item.site_id)) {
          seen.add(item.site_id);
          const labelName = item.site_name ? `${item.site_id} - ${item.site_name}` : item.site_id;
          uniqueSites.push({ value: item.site_id, label: labelName });
        }
      });
      return [{ value: 'All', label: 'All' }, ...uniqueSites.sort((a, b) => a.value.localeCompare(b.value))];
    }

    const uniqueValues = [...new Set(relevantDapot.map(item => item[targetKey]).filter(Boolean))];
    return ['All', ...uniqueValues.sort()];
  };

  const getWorstContributors = (dataKey, limit = 15) => {
    const siteAvg = {};
    chartData.forEach(d => {
      if (d[dataKey] == null) return; 
      if (!siteAvg[d.site_id]) siteAvg[d.site_id] = { sum: 0, count: 0, ava_power: 0, ava_transport: 0 };
      siteAvg[d.site_id].sum += Number(d[dataKey]);
      siteAvg[d.site_id].ava_power += Number(d.ava_power || d[dataKey]);
      siteAvg[d.site_id].ava_transport += Number(d.ava_transport || d[dataKey]);
      siteAvg[d.site_id].count += 1;
    });
    return Object.keys(siteAvg)
      .map(site_id => ({ 
        site_id, 
        [dataKey]: siteAvg[site_id].sum / siteAvg[site_id].count,
        ava_power: siteAvg[site_id].ava_power / siteAvg[site_id].count,
        ava_transport: siteAvg[site_id].ava_transport / siteAvg[site_id].count
      }))
      .sort((a, b) => a[dataKey] - b[dataKey])
      .slice(0, limit);
  };

  const worstINAP = getWorstContributors('inap_avail');
  const worstPower = getWorstContributors('ava_power');
  const worstTransport = getWorstContributors('ava_transport');

  const categories = [...new Set(chartData.map(item => item.period))].sort();

  const buildSeries = (key, name) => ({
    name,
    data: categories.map(date => {
      const dayData = chartData.filter(d => d.period === date && d[key] != null);
      if(!dayData.length) return null; 
      return {
        x: new Date(date).getTime(),
        y: parseFloat((dayData.reduce((acc, curr) => acc + Number(curr[key]), 0) / dayData.length).toFixed(2)),
        siteCount: dayData.length
      };
    }).filter(item => item !== null).sort((a, b) => a.x - b.x)
  });

  const buildSeriesByGroup = (groupKey, dataKey, groupList) => {
    return groupList.map(groupVal => ({
      name: groupVal,
      data: categories.map(date => {
        const match = chartData.filter(d => d.period === date && d[groupKey] === groupVal && d[dataKey] != null);
        if(!match.length) return null;
        return {
          x: new Date(date).getTime(),
          y: parseFloat((match.reduce((acc, curr) => acc + Number(curr[dataKey]), 0) / match.length).toFixed(2)),
          siteCount: match.length
        };
      }).filter(item => item !== null).sort((a, b) => a.x - b.x)
    }));
  };

  const seriesTypeAll = [
    buildSeries('ava_power', 'Power'), buildSeries('ava_transport', 'Transport'),
    buildSeries('all_ne_avail', 'All NE'), buildSeries('avail_ume', 'Avail UME')
  ];

  const siteClasses = getCascadingOptions('site_class').filter(opt => opt !== 'All' && opt !== 'Unknown');
  const seriesSiteClassPower = buildSeriesByGroup('site_class', 'ava_power', siteClasses);
  const seriesSiteClassTransport = buildSeriesByGroup('site_class', 'ava_transport', siteClasses);
  
  const gridCategories = getCascadingOptions('grid_category_new').filter(opt => opt !== 'All' && opt !== 'Unknown');
  const seriesGrid = buildSeriesByGroup('grid_category_new', 'ava_power', gridCategories);

  const baseChartOptions = {
    chart: { 
      type: 'line', 
      animations: { enabled: false }, 
      toolbar: { show: true, tools: { download: true, selection: true, zoom: true, zoomin: true, zoomout: true, pan: true, reset: true } }, 
      zoom: { enabled: true, type: 'x' } 
    },
    stroke: { width: 2, curve: 'smooth' }, 
    markers: { size: 0, hover: { size: 5 } }, 
    xaxis: { type: 'datetime', labels: { style: { fontSize: '9px' }, datetimeUTC: false } },
    yaxis: { max: 100, labels: { style: { fontSize: '9px' }, formatter: (val) => val.toFixed(1) } },
    legend: { position: 'top', fontSize: '11px', markers: { radius: 12 }, itemMargin: { horizontal: 10, vertical: 5 } },
    grid: { show: true, strokeDashArray: 3, borderColor: '#f1f1f1' },
    tooltip: {
      shared: true,
      intersect: false,
      theme: 'light',
      y: {
        formatter: function (val, { seriesIndex, dataPointIndex, w }) {
          const dataPoint = w?.globals?.initialSeries?.[seriesIndex]?.data?.[dataPointIndex];
          const count = dataPoint?.siteCount ? ` | ${dataPoint.siteCount} Site` : '';
          return `${val.toFixed(2)}% ${count}`;
        }
      }
    }
  };

  const filterDropdowns = [
    { label: 'NOP', key: 'nop' }, { label: 'Site ID', key: 'site_id' }, 
    { label: 'Site Class', key: 'site_class' }, { label: 'Kota/Kab', key: 'kota_kab' }, 
    { label: 'Kecamatan', key: 'kecamatan' }, { label: 'Link Route', key: 'link_route' }, 
    { label: 'Grid', key: 'grid_category_new' }
  ];

  return (
    <div className="p-2 bg-[#f3f4f6] min-h-screen font-sans pb-10">
      <style dangerouslySetInnerHTML={{__html: `.apexcharts-toolbar { transform: scale(0.7); transform-origin: top right; z-index: 90 !important; }`}} />

      {/* HEADER UPDATE DATA KANAN ATAS */}
      <div className="flex justify-end px-3 pt-2">
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1 rounded-full text-[10px] font-bold shadow-sm">
          Data Update: {dbUpdateRange.start} s/d {dbUpdateRange.end}
        </div>
      </div>

      <div className="bg-white p-3 mb-3 mt-2 border-b flex items-center gap-3 overflow-x-visible text-[10px] shadow-sm rounded-lg flex-wrap z-50 relative">
        <div className="flex flex-col">
          <label className="text-gray-500 mb-1 font-semibold">Date Range</label>
          <div className="flex items-center">
            <input type="date" value={filters.startDate} onChange={(e) => handleFilterChange('startDate', e.target.value)} className="border px-2 py-1.5 rounded-l outline-none focus:border-blue-400 text-[10px]"/>
            <span className="bg-gray-100 border-y px-2 py-1.5 text-gray-400">to</span>
            <input type="date" value={filters.endDate} onChange={(e) => handleFilterChange('endDate', e.target.value)} className="border-y border-r px-2 py-1.5 rounded-r outline-none focus:border-blue-400 text-[10px]"/>
          </div>
        </div>
        
        {filterDropdowns.map(filter => (
          <SearchableSelect 
            key={filter.key} 
            label={filter.label} 
            options={getCascadingOptions(filter.key)} 
            value={filters[filter.key]} 
            onChange={(val) => handleFilterChange(filter.key, val)} 
          />
        ))}

        {loading && <div className="text-blue-500 font-bold animate-pulse text-[11px] ml-2">Loading data...</div>}
      </div>

      <div className="px-2 relative z-0">
        <Uploader />

        <div className="flex gap-3 mb-3 h-[280px]">
          <div className="flex-1 bg-white flex shadow-sm rounded border border-gray-100 transition-all hover:shadow-md">
            <div className="flex-1 p-2 flex flex-col min-w-0">
              <h3 className="text-xs font-bold text-center text-gray-700 mb-1 mt-1">Availability by Type (All)</h3>
              <div className="flex-1">
                {seriesTypeAll.some(s => s.data && s.data.length > 0) ? (
                  <Chart options={{...baseChartOptions, colors: ['#008FFB', '#775DD0', '#FF4560', '#546E7A']}} series={seriesTypeAll} type="line" height="100%" />
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-400 text-xs">Data tidak tersedia untuk filter ini</div>
                )}
              </div>
            </div>
            <ContributorList title="Contributor (Selected Filter)" data={worstINAP} dataKey="inap_avail" dapotMaster={dapotMaster} chartDataLength={categories.length} />
          </div>
          <div className="flex-1 bg-white flex shadow-sm rounded border border-gray-100 transition-all hover:shadow-md">
            <div className="flex-1 p-2 flex flex-col min-w-0">
              <h3 className="text-xs font-bold text-center text-gray-700 mb-1 mt-1">Availability by Type (Exclude SPS)</h3>
              <div className="flex-1">
                {seriesTypeAll.some(s => s.data && s.data.length > 0) ? (
                  <Chart options={{...baseChartOptions, colors: ['#008FFB', '#775DD0', '#FF4560', '#546E7A']}} series={seriesTypeAll} type="line" height="100%" />
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-400 text-xs">Data tidak tersedia untuk filter ini</div>
                )}
              </div>
            </div>
            <ContributorList title="Contributor (Selected Filter)" data={worstINAP} dataKey="inap_avail" dapotMaster={dapotMaster} chartDataLength={categories.length} />
          </div>
        </div>

        <div className="flex gap-3 mb-3 h-[280px]">
          <div className="flex-1 bg-white flex shadow-sm rounded border border-gray-100 relative flex-row transition-all hover:shadow-md">
            <div className="absolute left-0 top-0 bottom-0 w-6 bg-gray-50 border-r flex items-center justify-center z-10 rounded-l">
              <span className="-rotate-90 text-[10px] font-bold text-gray-400 tracking-widest whitespace-nowrap">POWER</span>
            </div>
            <div className="flex-1 p-2 flex flex-col min-w-0 pl-8">
              <h3 className="text-xs font-bold text-center text-gray-700 mb-1 mt-1">Availability by Site Class (Power)</h3>
              <div className="flex-1">
                {seriesSiteClassPower.some(s => s.data && s.data.length > 0) ? (
                  <Chart options={{...baseChartOptions, colors: ['#E91E63', '#008FFB', '#FEB019', '#9E9E9E', '#795548']}} series={seriesSiteClassPower} type="line" height="100%" />
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-400 text-xs">Data Site Class tidak tersedia</div>
                )}
              </div>
            </div>
            <ContributorList title="Contributor (Worst Power)" data={worstPower} dataKey="ava_power" dapotMaster={dapotMaster} chartDataLength={categories.length} />
          </div>
          
          <div className="flex-1 bg-white flex shadow-sm rounded border border-gray-100 relative flex-row transition-all hover:shadow-md">
            <div className="absolute left-0 top-0 bottom-0 w-6 bg-gray-50 border-r flex items-center justify-center z-10 rounded-l">
              <span className="-rotate-90 text-[10px] font-bold text-gray-400 tracking-widest whitespace-nowrap">TRANSPORT</span>
            </div>
            <div className="flex-1 p-2 flex flex-col min-w-0 pl-8">
              <h3 className="text-xs font-bold text-center text-gray-700 mb-1 mt-1">Availability by Site Class (Transport)</h3>
              <div className="flex-1">
                {seriesSiteClassTransport.some(s => s.data && s.data.length > 0) ? (
                  <Chart options={{...baseChartOptions, colors: ['#E91E63', '#008FFB', '#FEB019', '#9E9E9E', '#795548']}} series={seriesSiteClassTransport} type="line" height="100%" />
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-400 text-xs">Data Site Class tidak tersedia</div>
                )}
              </div>
            </div>
            <ContributorList title="Contributor (Worst Transport)" data={worstTransport} dataKey="ava_transport" dapotMaster={dapotMaster} chartDataLength={categories.length} />
          </div>
        </div>

        <div className="bg-white flex shadow-sm h-[280px] mb-4 rounded border border-gray-100 transition-all hover:shadow-md">
          <div className="flex-1 p-2 flex flex-col min-w-0">
            <h3 className="text-xs font-bold text-center text-gray-700 mb-1 mt-1">Availability by Grid Category</h3>
            <div className="flex-1">
              {seriesGrid.some(s => s.data && s.data.length > 0) ? (
                <Chart options={{...baseChartOptions, yaxis: { max: 100 }, colors: ['#03A9F4', '#3F51B5', '#FF9800', '#9C27B0', '#E91E63']}} series={seriesGrid} type="line" height="100%" />
              ) : (
                <div className="flex h-full items-center justify-center text-gray-400 text-xs">Data Grid Category tidak tersedia</div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
