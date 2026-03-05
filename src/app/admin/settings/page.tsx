'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ─── Types ──────────────────────────────────────────────────────────
interface AuditLog {
  id: string;
  level: 'info' | 'warn' | 'error' | 'critical';
  category: string;
  action: string;
  message: string;
  user_id: string | null;
  ip_address: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface AuditResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const LEVELS = ['all', 'info', 'warn', 'error', 'critical'] as const;
const CATEGORIES = ['all', 'auth', 'payment', 'order', 'delivery', 'admin', 'security', 'system', 'user', 'api'] as const;

const LEVEL_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  info:     { bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-500' },
  warn:     { bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-500' },
  error:    { bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500' },
  critical: { bg: 'bg-red-100',   text: 'text-red-800',    dot: 'bg-red-700' },
};

const CATEGORY_STYLES: Record<string, string> = {
  auth:     'bg-purple-100 text-purple-700',
  payment:  'bg-green-100 text-green-700',
  order:    'bg-blue-100 text-blue-700',
  delivery: 'bg-orange-100 text-orange-700',
  admin:    'bg-indigo-100 text-indigo-700',
  security: 'bg-red-100 text-red-700',
  system:   'bg-gray-100 text-gray-700',
  user:     'bg-teal-100 text-teal-700',
  api:      'bg-cyan-100 text-cyan-700',
};

// ─── Audit Tab Component ────────────────────────────────────────────
function AuditTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [level, setLevel] = useState('all');
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '30',
      });
      if (level !== 'all') params.set('level', level);
      if (category !== 'all') params.set('category', category);
      if (search) params.set('search', search);

      const res = await fetch(`/api/admin/audit-logs?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data: AuditResponse = await res.json();
      setLogs(data.logs);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [page, level, category, search]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Auto-refresh every 10s
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const relativeTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Level filter */}
          <select
            value={level}
            onChange={(e) => { setLevel(e.target.value); setPage(1); }}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l === 'all' ? 'All Levels' : l.charAt(0).toUpperCase() + l.slice(1)}
              </option>
            ))}
          </select>

          {/* Category filter */}
          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c === 'all' ? 'All Categories' : c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 items-center">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search logs..."
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 w-48 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <button
              type="submit"
              className="text-sm px-3 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              Search
            </button>
          </form>

          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`text-sm px-3 py-2 rounded-lg border transition-colors ${
              autoRefresh
                ? 'bg-green-50 border-green-300 text-green-700'
                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
            title={autoRefresh ? 'Auto-refresh ON (10s)' : 'Auto-refresh OFF'}
          >
            <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${autoRefresh ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            Live
          </button>

          {/* Manual refresh */}
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="text-sm px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              'Refresh'
            )}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 text-sm text-gray-500">
        <span>{total.toLocaleString()} total logs</span>
        {level !== 'all' && (
          <span className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${LEVEL_STYLES[level]?.dot || 'bg-gray-400'}`} />
            Filtered by: {level}
          </span>
        )}
        {category !== 'all' && (
          <span>Category: {category}</span>
        )}
      </div>

      {/* Log entries */}
      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        {loading && logs.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <svg className="animate-spin h-6 w-6 mr-3" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading audit logs...
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <svg className="mx-auto h-12 w-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm font-medium">No audit logs found</p>
            <p className="text-xs mt-1">Logs will appear here as events occur in your system.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {/* Table header */}
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div className="col-span-1">Level</div>
              <div className="col-span-1">Category</div>
              <div className="col-span-2">Action</div>
              <div className="col-span-4">Message</div>
              <div className="col-span-2">Time</div>
              <div className="col-span-1">IP</div>
              <div className="col-span-1"></div>
            </div>

            {logs.map((log) => {
              const style = LEVEL_STYLES[log.level] || LEVEL_STYLES.info;
              const catStyle = CATEGORY_STYLES[log.category] || 'bg-gray-100 text-gray-700';
              const isExpanded = expandedId === log.id;

              return (
                <div key={log.id}>
                  <div
                    className={`grid grid-cols-12 gap-2 px-4 py-3 text-sm hover:bg-gray-50 cursor-pointer transition-colors ${
                      log.level === 'critical' ? 'bg-red-50/50' : log.level === 'error' ? 'bg-red-50/30' : ''
                    }`}
                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  >
                    {/* Level */}
                    <div className="col-span-1 flex items-center">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                        {log.level}
                      </span>
                    </div>

                    {/* Category */}
                    <div className="col-span-1 flex items-center">
                      <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${catStyle}`}>
                        {log.category}
                      </span>
                    </div>

                    {/* Action */}
                    <div className="col-span-2 flex items-center">
                      <span className="text-gray-900 font-mono text-xs truncate" title={log.action}>
                        {log.action}
                      </span>
                    </div>

                    {/* Message */}
                    <div className="col-span-4 flex items-center">
                      <span className="text-gray-600 truncate" title={log.message}>
                        {log.message}
                      </span>
                    </div>

                    {/* Time */}
                    <div className="col-span-2 flex items-center">
                      <span className="text-gray-400 text-xs" title={formatDate(log.created_at)}>
                        {relativeTime(log.created_at)}
                      </span>
                    </div>

                    {/* IP */}
                    <div className="col-span-1 flex items-center">
                      <span className="text-gray-400 font-mono text-xs truncate">
                        {log.ip_address || '-'}
                      </span>
                    </div>

                    {/* Expand */}
                    <div className="col-span-1 flex items-center justify-end">
                      <svg
                        className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-4 py-4 bg-gray-50 border-t border-gray-100">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500 text-xs font-medium uppercase">Log ID</span>
                          <p className="font-mono text-xs text-gray-700 mt-0.5">{log.id}</p>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs font-medium uppercase">Timestamp</span>
                          <p className="text-xs text-gray-700 mt-0.5">{formatDate(log.created_at)}</p>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs font-medium uppercase">User ID</span>
                          <p className="font-mono text-xs text-gray-700 mt-0.5">{log.user_id || 'N/A (system)'}</p>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs font-medium uppercase">IP Address</span>
                          <p className="font-mono text-xs text-gray-700 mt-0.5">{log.ip_address || 'N/A'}</p>
                        </div>
                        <div className="col-span-2">
                          <span className="text-gray-500 text-xs font-medium uppercase">Full Message</span>
                          <p className="text-sm text-gray-700 mt-0.5">{log.message}</p>
                        </div>
                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                          <div className="col-span-2">
                            <span className="text-gray-500 text-xs font-medium uppercase">Metadata</span>
                            <pre className="mt-1 p-3 bg-gray-900 text-green-400 rounded-lg text-xs overflow-x-auto font-mono">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              First
            </button>
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Last
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Settings Page ─────────────────────────────────────────────
export default function AdminSettingsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="sm:flex sm:items-center sm:justify-between mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Admin Settings</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <Tabs defaultValue="general" className="w-full">
          <div className="border-b border-gray-200">
            <TabsList className="flex -mb-px space-x-1 px-6 bg-transparent">
              <TabsTrigger
                value="general"
                className="py-3.5 px-4 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300 data-[state=active]:border-gray-900 data-[state=active]:text-gray-900 transition-colors rounded-none bg-transparent shadow-none"
              >
                General Settings
              </TabsTrigger>
              <TabsTrigger
                value="notifications"
                className="py-3.5 px-4 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300 data-[state=active]:border-gray-900 data-[state=active]:text-gray-900 transition-colors rounded-none bg-transparent shadow-none"
              >
                Notifications
              </TabsTrigger>
              <TabsTrigger
                value="audit"
                className="py-3.5 px-4 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300 data-[state=active]:border-gray-900 data-[state=active]:text-gray-900 transition-colors rounded-none bg-transparent shadow-none"
              >
                Audit Log
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="p-6">
            <TabsContent value="general">
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <h3 className="mt-3 text-lg font-medium text-gray-900">General Settings</h3>
                <p className="mt-1 text-sm text-gray-500">Coming soon in a future update.</p>
              </div>
            </TabsContent>

            <TabsContent value="notifications">
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <h3 className="mt-3 text-lg font-medium text-gray-900">Notification Settings</h3>
                <p className="mt-1 text-sm text-gray-500">Coming soon in a future update.</p>
              </div>
            </TabsContent>

            <TabsContent value="audit">
              <AuditTab />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
