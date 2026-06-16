'use client';
import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import dynamic from 'next/dynamic';
import Uploader from '../components/Uploader';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

// 1. Kunci posisi variabel filter di paling atas biar Vercel anteng pas build
const filterDropdowns = [
  { label: 'NOP', key: 'nop' }, { label: 'Site ID', key: 'site_id' }, 
  { label: 'Site Class', key: 'site_class' }, { label: 'Kota/Kab', key: 'kota_kab' }, 
  { label: 'Kecamatan', key: 'kecamatan' }, { label: 'Link Route', key: 'link_route' }, 
  { label: 'Grid', key: 'grid_category_new' }
];

// KOMPONEN: CUSTOM DROPDOWN SEARCHABLE
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
    <div className="flex flex-col w-[48%] md:w-40 relative" ref={wrapperRef}>
      <label className="text-gray-500 mb-1 truncate font-semibold text-[10px]">{label}</label>
      <div 
        className="border px-2 py-1.5 rounded outline-none focus:border-blue-400 bg-white cursor-pointer flex justify-between items-center text-[10px] shadow-sm hover:border-blue-300 transition-colors" 
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate flex-1 pr-1">{activeLabel}</span>
        {value !== 'All' ? (
          <button onClick={(e) => { e.stopPropagation(); onChange('All'); }} className="text-red-400 hover:text-red-600 font-bold ml-1 px-1">✕</button>
        ) : (
          <span className="text-gray-400 text-[8px] ml-1">▼</span>
        )}
      </div>
      {isOpen && (
        <div className="absolute top-full left-0 w-[200%] md:w-64 mt-1 bg-white border shadow-xl z-[100] rounded">
          <div className="p-1.5 border-b bg-gray-50 rounded-t">
            <input type="text" className="w-full px-2 py-1 text-[10px] outline-none border rounded" placeholder={`Cari ${label}...`} value={search} onChange={(e) => setSearch(e.target.value)} onClick={(e) => e.stopPropagation()} autoFocus />
          </div>
          <ul className="max-h-48 overflow-y-auto">
            {filteredOptions.length > 0 ? filteredOptions.map(opt => (
              <li key={opt.value || opt} className="px-3 py-1.5 hover:bg-blue-50 cursor-pointer text-[10px] border-b border-gray-50 truncate" onClick={() => { onChange(opt.value || opt); setIsOpen(false); setSearch(''); }}>{opt.label || opt}</li>
            )) : <li className="px-3 py-2 text-[10px] text-gray-400 italic">Tidak ditemukan</li>}
          </ul>
        </div>
      )}
    </div>
  );
};

// KOMPONEN: CONTRIBUTOR LIST
const ContributorList = ({ title, data, dataKey, dapotMaster, onHover, onClickSite }) => (
  <div className="w-full md:w-48 bg-white p-3 border-t md:border-t-0 md:border-l border-gray-100 flex flex-col z-10">
    <h4 className="text-[11px] font-bold text-gray-700 mb-2 flex items-center"><span className="text-rose-600 mr-2 text-lg leading-none">•</span> {title}</h4>
    <div className="flex-1 overflow-y-auto pr-1 max-h-32 md:max-h-full">
      {data.map((item, idx) => {
        const val = Number(item[dataKey]) || 0;
        const siteMeta = dapotMaster.find(d => d.site_id === item.site_id) || {};
        return (
          <div key={idx} className="flex items-center text-[10px] mb-1.5 cursor-pointer hover:bg-gray-50 rounded p-0.5" onMouseEnter={(e) => onHover({ x: e.clientX, y: e.clientY, item, meta: siteMeta, val })} onMouseLeave={() => onHover(null)} onClick={() => onClickSite(item.site_id)}>
            <span className="w-12 truncate text-gray-500 font-medium">{item.site_id}</span>
            <div className="flex-1 h-2.5 bg-gray-100 mx-2 relative rounded-sm overflow-hidden">
              <div className="absolute top-0 right-0 h-full bg-rose-500 rounded-sm" style={{ width: `${Math.max(0, 100 - val)}%` }}></div>
            </div>
            <span className="w-8 text-right text-gray-700 font-bold">{val.toFixed(2)}</span>
          </div>
        );
      })}
    </div>
  </div>
);

export default function Dashboard() {
  const [dapotMaster, setDapotMaster] = useState([]); 
  const [analytics, setAnalytics] = useState({ summary: [], site_class_data: [], grid_data: [], worst_inap: [], worst_power: [], worst_transport: [] });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [dbUpdateRange, setDbUpdateRange] = useState({ start: '-', end: '-' });
  const [tooltipData, setTooltipData] = useState(null); 

  const [filters, setFilters] = useState({ startDate: '', endDate: '', nop: 'All', site_id: 'All', site_class: 'All', kota_kab: 'All', kecamatan: 'All', link_route: 'All', grid_category_new: 'All' });

  const handleSyncDB = async () => {
    setSyncing(true);
    await supabase.rpc('refresh_dashboard');
    setSyncing(false);
    alert("✅ Data terbaru sudah diproses server! Klik OK untuk memuat grafik.");
    window.location.reload();
  };

  // Paging estafet balikin khusus data dapot biar bypass limit 1000 server & nampilkan seluruh pilihan filter
  const fetchDapotInChunks = async () => {
    let allData = [];
    let start = 0;
    const step = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('dapot_data')
        .select('site_id, site_name, departemen, site_class, power_type, transport_type, category_type_non_3t, jumlah_site_anakan, site_id_anakan, grid_category_new, kotakab, kecamatan, link_route')
        .range(start, start + step - 1);
      
      if (error || !data || data.length === 0) {
        hasMore = false;
      } else {
        allData = allData.concat(data);
        if (data.length < step) hasMore = false;
        else start += step;
      }
    }
    return allData;
  };

  useEffect(() => {
    async function init() {
      setLoading(true);
      const dapot = await fetchDapotInChunks();
      if (dapot && dapot.length > 0) {
        setDapotMaster(dapot.map(d => ({ ...d, nop: d.departemen, kota_kab: d.kotakab, category: d.category_type_non_3t, child_total: d.jumlah_site_anakan, child_site_id: d.site_id_anakan })));
      }
      
      const { data: minD } = await supabase.from('dashboard_master_view').select('period').order('period', { ascending: true }).limit(1);
      const { data: maxD } = await supabase.from('dashboard_master_view').select('period').order('period', { ascending: false }).limit(1);
      
      if (minD?.[0] && maxD?.[0]) {
        setDbUpdateRange({ start: minD[0].period, end: maxD[0].period });
        const d = new Date(maxD[0].period); d.setDate(d.getDate() - 30);
        setFilters(prev => ({ ...prev, startDate: d.toISOString().split('T')[0], endDate: maxD[0].period }));
      }
      setLoading(false);
    }
    init();
  }, []);

  useEffect(() => {
    async function fetchAnalytics() {
      if (!filters.startDate || !filters.endDate) return;
      setLoading(true);
      const { data, error } = await supabase.rpc('get_dashboard_analytics', {
        p_start: filters.startDate, p_end: filters.endDate, p_nop: filters.nop, p_site: filters.site_id,
        p_class: filters.site_class, p_kab: filters.kota_kab, p_kec: filters.kecamatan, p_route: filters.link_route, p_grid: filters.grid_category_new
      });
      if (!error && data) setAnalytics(data);
      else console.error(error);
      setLoading(false);
    }
    fetchAnalytics();
  }, [filters]);

  const handleFilterChange = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));

  const getCascadingOptions = (targetKey) => {
    const relevant = dapotMaster.filter(d => {
      for (const k in filters) { if (k === 'startDate' || k === 'endDate' || k === targetKey) continue; if (filters[k] !== 'All' && d[k] !== filters[k]) return false; }
      return true;
    });
    if (targetKey === 'site_id') {
      const seen = new Set(); const res = [];
      relevant.forEach(item => { if (item.site_id && !seen.has(item.site_id)) { seen.add(item.site_id); res.push({ value: item.site_id, label: item.site_name ? `${item.site_id} - ${item.site_name}` : item.site_id }); }});
      return [{ value: 'All', label: 'All' }, ...res.sort((a, b) => a.value.localeCompare(b.value))];
    }
    return ['All', ...[...new Set(relevant.map(item => item[targetKey]).filter(Boolean))].sort()];
  };

  const categories = useMemo(() => (analytics.summary || []).map(item => item.period), [analytics.summary]);
  const buildSeries = (key, name) => ({ name, data: (analytics.summary || []).map(item => ({ x: new Date(item.period).getTime(), y: item[key], siteCount: item.site_count })) });
  const buildSeriesGroup = (groupKey, dataKey, groupList) => groupList.map(g => ({ name: g, data: (analytics.site_class_data || analytics.grid_data || []).filter(item => item[groupKey] === g).map(item => ({ x: new Date(item.period).getTime(), y: item[dataKey] })) }));

  const seriesAll = [buildSeries('avg_power', 'Power'), buildSeries('avg_transport', 'Transport'), buildSeries('avg_all_ne', 'All NE'), buildSeries('avg_ume', 'Avail UME')];
  const siteClassesOrder = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'];
  const siteClasses = getCascadingOptions('site_class').filter(o => o !== 'All').sort((a,b) => siteClassesOrder.indexOf(a.toUpperCase()) - siteClassesOrder.indexOf(b.toUpperCase()));
  const gridCategories = getCascadingOptions('grid_category_new').filter(o => o !== 'All');

  const baseChartOptions = {
    chart: { type: 'line', animations: { enabled: false }, toolbar: { show: true } },
    stroke: { width: 2, curve: 'smooth' }, xaxis: { type: 'datetime', labels: { style: { fontSize: '9px' } } },
    yaxis: { max: 100, labels: { style: { fontSize: '9px' } } }, legend: { position: 'top', fontSize: '9px' },
    tooltip: { shared: true, intersect: false, theme: 'light', y: { formatter: (v, { seriesIndex, dataPointIndex, w }) => `${v}% ${w?.globals?.initialSeries?.[seriesIndex]?.data?.[dataPointIndex]?.siteCount ? `| ${w.globals.initialSeries[seriesIndex].data[dataPointIndex].siteCount} Site` : ''}` } }
  };

  const getDynamicClassColor = (cls) => {
    if (cls === 'BRONZE') return 'text-[#CD7F32]'; if (cls === 'SILVER') return 'text-[#C0C0C0] font-bold';
    if (cls === 'GOLD') return 'text-[#FFD700]'; if (cls === 'PLATINUM') return 'text-[#3B82F6]'; return 'text-[#FF69B4]';
  };

  return (
    <div className="p-2 md:p-4 bg-[#f3f4f6] min-h-screen font-sans pb-10">
      <style dangerouslySetInnerHTML={{__html: `.apexcharts-toolbar { transform: scale(0.7); transform-origin: top right; z-index: 90 !important; }`}} />

      {tooltipData && (
        <div className="fixed bg-white border border-gray-200 shadow-2xl p-3 rounded-lg z-[9999] w-56 text-[10px] text-gray-600 pointer-events-none" style={{ top: Math.min(tooltipData.y + 10, window.innerHeight - 260), left: Math.min(tooltipData.x + 10, window.innerWidth - 250) }}>
          <div className="flex flex-col gap-1.5">
            <div className="border-b pb-1 flex justify-between"><span className="font-bold text-gray-800">Site ID: {tooltipData.item.site_id}</span><span className={`font-bold ${getDynamicClassColor(tooltipData.meta.site_class)}`}>{tooltipData.meta.site_class || '-'}</span></div>
            <div className="truncate"><span className="font-semibold">Name:</span> {tooltipData.meta.site_name || '-'}</div>
            <div className="grid grid-cols-2 gap-1 border-t border-b py-1 bg-gray-50 p-1 rounded">
              <div><p className="font-semibold text-gray-500">Ava Power</p><p className="font-bold text-gray-800">{(tooltipData.item.ava_power || tooltipData.val).toFixed(2)}%</p></div>
              <div><p className="font-semibold text-gray-500">Ava Transport</p><p className="font-bold text-gray-800">{(tooltipData.item.ava_transport || tooltipData.val).toFixed(2)}%</p></div>
            </div>
            <div className="flex justify-between"><span className="font-semibold">Power/Trans:</span> <span className="truncate ml-2">{tooltipData.meta.power_type || '-'} / {tooltipData.meta.transport_type || '-'}</span></div>
            <div className="text-[9px] text-gray-400 pt-0.5 border-t">Category: {tooltipData.meta.category || '-'} | Child: {tooltipData.meta.child_total || '0'}</div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-center px-1 mb-2 gap-2">
        <h1 className="font-bold text-gray-700 text-lg md:text-xl">Network Availability Dashboard</h1>
        <div className="flex items-center gap-2">
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-full text-[10px] font-bold shadow-sm">Data Range: {dbUpdateRange.start} s/d {dbUpdateRange.end}</div>
          <button onClick={handleSyncDB} disabled={syncing} className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-full text-[10px] font-bold shadow-sm flex items-center disabled:opacity-50">
            {syncing ? 'Memproses Tabel...' : '🔄 Sync Database'}
          </button>
        </div>
      </div>

      <div className="bg-white p-3 mb-3 border-b flex items-center gap-2 overflow-x-visible text-[10px] shadow-sm rounded-lg flex-wrap z-50 relative">
        <div className="flex flex-col w-full md:w-auto mb-2 md:mb-0">
          <label className="text-gray-500 mb-1 font-semibold">Date Range</label>
          <div className="flex items-center w-full md:w-auto">
            <input type="date" value={filters.startDate} onChange={(e) => handleFilterChange('startDate', e.target.value)} className="border px-2 py-1.5 rounded-l text-[10px] w-1/2 md:w-auto"/>
            <span className="bg-gray-100 border-y px-2 py-1.5 text-gray-400">to</span>
            <input type="date" value={filters.endDate} onChange={(e) => handleFilterChange('endDate', e.target.value)} className="border-y border-r px-2 py-1.5 rounded-r text-[10px] w-1/2 md:w-auto"/>
          </div>
        </div>
        {filterDropdowns.map(f => (<SearchableSelect key={f.key} label={f.label} options={getCascadingOptions(f.key)} value={filters[f.key]} onChange={(v) => handleFilterChange(f.key, v)} />))}
        {loading && <div className="text-blue-500 font-bold animate-pulse text-[11px] px-2 mt-2 md:mt-0">Tarik Data Server...</div>}
      </div>

      <div className="relative z-0">
        <div className="hidden md:block mb-3"><Uploader /></div>
        
        {/* ROW 1: TYPE ALL & EXCLUDE SPS (Dua kolom sejajar kiri kanan) */}
        <div className="flex flex-col md:flex-row gap-3 mb-3 h-auto md:h-[280px]">
          <div className="flex-1 bg-white flex flex-col md:flex-row shadow-sm rounded border border-gray-100 h-72 md:h-full">
            <div className="flex-1 p-2 flex flex-col min-w-0">
              <h3 className="text-xs font-bold text-center text-gray-700 mb-1">Availability by Type (All)</h3>
              <div className="flex-1">{analytics.summary?.length > 0 ? <Chart options={baseChartOptions} series={seriesAll} type="line" height="100%" /> : <div className="flex h-full items-center justify-center text-gray-400 text-xs">Pilih filter tanggal valid</div>}</div>
            </div>
            <ContributorList title="Worst Contributor" data={analytics.worst_inap || []} dataKey="inap_avail" dapotMaster={dapotMaster} onHover={setTooltipData} onClickSite={(id) => handleFilterChange('site_id', id)} />
          </div>
          
          <div className="flex-1 bg-white flex flex-col md:flex-row shadow-sm rounded border border-gray-100 h-72 md:h-full">
            <div className="flex-1 p-2 flex flex-col min-w-0">
              <h3 className="text-xs font-bold text-center text-gray-700 mb-1">Availability by Type (Exclude SPS)</h3>
              <div className="flex-1">{analytics.summary?.length > 0 ? <Chart options={baseChartOptions} series={seriesAll} type="line" height="100%" /> : <div className="flex h-full items-center justify-center text-gray-400 text-xs">Pilih filter tanggal valid</div>}</div>
            </div>
            <ContributorList title="Worst Contributor" data={analytics.worst_inap || []} dataKey="inap_avail" dapotMaster={dapotMaster} onHover={setTooltipData} onClickSite={(id) => handleFilterChange('site_id', id)} />
          </div>
        </div>

        {/* ROW 2: SITE CLASS POWER & SITE CLASS TRANSPORT (Dua kolom sejajar kiri kanan) */}
        <div className="flex flex-col md:flex-row gap-3 mb-3 h-auto md:h-[280px]">
          <div className="flex-1 bg-white flex flex-col md:flex-row shadow-sm rounded border border-gray-100 relative h-72 md:h-full">
            <div className="absolute hidden md:flex left-0 top-0 bottom-0 w-6 bg-gray-50 border-r items-center justify-center z-10 rounded-l"><span className="-rotate-90 text-[10px] font-bold text-gray-400 tracking-widest">POWER</span></div>
            <div className="flex-1 p-2 flex flex-col min-w-0 md:pl-8">
              <h3 className="text-xs font-bold text-center text-gray-700 mb-1">Availability by Site Class (Power)</h3>
              <div className="flex-1">{analytics.site_class_data?.length > 0 ? <Chart options={{...baseChartOptions, colors: ['#CD7F32', '#C0C0C0', '#FFD700', '#3B82F6', '#FF69B4']}} series={buildSeriesGroup('site_class', 'avg_power', siteClasses)} type="line" height="100%" /> : <div className="flex h-full items-center justify-center text-gray-400 text-xs">Data Class Kosong</div>}</div>
            </div>
            <ContributorList title="Worst Power" data={analytics.worst_power || []} dataKey="ava_power" dapotMaster={dapotMaster} onHover={setTooltipData} onClickSite={(id) => handleFilterChange('site_id', id)} />
          </div>
          
          <div className="flex-1 bg-white flex flex-col md:flex-row shadow-sm rounded border border-gray-100 relative h-72 md:h-full">
            <div className="absolute hidden md:flex left-0 top-0 bottom-0 w-6 bg-gray-50 border-r items-center justify-center z-10 rounded-l"><span className="-rotate-90 text-[10px] font-bold text-gray-400 tracking-widest">TRANSPORT</span></div>
            <div className="flex-1 p-2 flex flex-col min-w-0 md:pl-8">
              <h3 className="text-xs font-bold text-center text-gray-700 mb-1">Availability by Site Class (Transport)</h3>
              <div className="flex-1">{analytics.site_class_data?.length > 0 ? <Chart options={{...baseChartOptions, colors: ['#CD7F32', '#C0C0C0', '#FFD700', '#3B82F6', '#FF69B4']}} series={buildSeriesGroup('site_class', 'avg_transport', siteClasses)} type="line" height="100%" /> : <div className="flex h-full items-center justify-center text-gray-400 text-xs">Data Class Kosong</div>}</div>
            </div>
            <ContributorList title="Worst Transport" data={analytics.worst_transport || []} dataKey="ava_transport" dapotMaster={dapotMaster} onHover={setTooltipData} onClickSite={(id) => handleFilterChange('site_id', id)} />
          </div>
        </div>

        {/* ROW 3: GRID CATEGORY (Balikin lebar penuh) */}
        <div className="bg-white flex flex-col md:flex-row shadow-sm h-64 md:h-[280px] mb-4 rounded border border-gray-100 transition-all hover:shadow-md">
          <div className="flex-1 p-2 flex flex-col min-w-0">
            <h3 className="text-xs font-bold text-center text-gray-700 mb-1 mt-1">Availability by Grid Category</h3>
            <div className="flex-1">{analytics.grid_data?.length > 0 ? <Chart options={{...baseChartOptions, colors: ['#03A9F4', '#3F51B5', '#FF9800', '#9C27B0', '#E91E63']}} series={buildSeriesGroup('grid_category_new', 'avg_power', gridCategories)} type="line" height="100%" /> : <div className="flex h-full items-center justify-center text-gray-400 text-xs">Data Grid Category Kosong</div>}</div>
          </div>
        </div>

      </div>
    </div>
  );
}
