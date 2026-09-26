import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ForceGraph2D, { ForceGraphMethods } from 'react-force-graph-2d';
import { 
  Loader2, 
  AlertCircle, 
  X, 
  Search, 
  SlidersHorizontal, 
  RotateCcw, 
  ZoomIn, 
  ZoomOut, 
  Play, 
  Pause, 
  Maximize2, 
  ChevronRight, 
  ExternalLink,
  Sun,
  Moon
} from 'lucide-react';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../shared/supabase';

export type NodeGroup = 'client' | 'recruiter' | 'job' | 'source' | 'category';

export interface GraphNode {
  id: string;
  name: string;
  group: NodeGroup;
  val: number;
  color?: string;
  details?: any;
  degree?: number;
  x?: number;
  y?: number;
}

export interface GraphLink {
  source: string | any;
  target: string | any;
  color?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

// Obsidian Dark Theme palette
export const OBSIDIAN_DARK_COLORS: Record<NodeGroup, string> = {
  client: '#a855f7',    // Electric Purple
  recruiter: '#38bdf8', // Cyan / Sky Blue
  category: '#f43f5e',  // Rose Red
  job: '#34d399',       // Mint / Emerald
  source: '#fbbf24',    // Amber Gold
};

// Obsidian Light Theme palette
export const OBSIDIAN_LIGHT_COLORS: Record<NodeGroup, string> = {
  client: '#7c3aed',    // Deep Violet
  recruiter: '#0284c7', // Sky Blue
  category: '#e11d48',  // Rose Crimson
  job: '#059669',       // Deep Emerald
  source: '#d97706',    // Warm Amber
};

export const GraphTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rawGraphData, setRawGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraphMethods>();
  
  // Theme state: default to Obsidian dark theme, synced with dashboard theme
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('rs_dashboard_theme') as 'dark' | 'light') || 
           (localStorage.getItem('rs_graph_theme') as 'dark' | 'light') || 
           'dark';
  });

  useEffect(() => {
    const handleThemeSync = () => {
      const isDocDark = document.documentElement.classList.contains('dark');
      setTheme(isDocDark ? 'dark' : 'light');
    };
    handleThemeSync();

    const observer = new MutationObserver(handleThemeSync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    window.addEventListener('storage', handleThemeSync);
    return () => {
      observer.disconnect();
      window.removeEventListener('storage', handleThemeSync);
    };
  }, []);

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('rs_dashboard_theme', next);
      localStorage.setItem('rs_graph_theme', next);
      if (next === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return next;
    });
  };

  const activeColors = useMemo(() => {
    return theme === 'dark' ? OBSIDIAN_DARK_COLORS : OBSIDIAN_LIGHT_COLORS;
  }, [theme]);

  // Selection and hover
  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null);
  const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set());
  const [highlightLinks, setHighlightLinks] = useState<Set<any>>(new Set());
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  // Obsidian Controls & Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPhysicsPaused, setIsPhysicsPaused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterJobCount, setFilterJobCount] = useState<number | 'all'>('all');
  
  // Group Visibility Toggles
  const [visibleGroups, setVisibleGroups] = useState<Record<NodeGroup, boolean>>({
    client: true,
    recruiter: true,
    category: true,
    job: true,
    source: true,
  });

  // Display Settings
  const [labelMode, setLabelMode] = useState<'hover' | 'zoom' | 'always'>('zoom');
  const [nodeScale, setNodeScale] = useState<number>(1.1);
  const [linkThickness, setLinkThickness] = useState<number>(1.2);

  // Physics Force Settings
  const [repulsionStrength, setRepulsionStrength] = useState<number>(-60);
  const [linkDistance, setLinkDistance] = useState<number>(75);
  const [centerStrength, setCenterStrength] = useState<number>(0.15);

  // Resize observer
  useEffect(() => {
    if (containerRef.current) {
      setDimensions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight
      });
      const observer = new ResizeObserver(entries => {
        if (entries[0]) {
          setDimensions({
            width: entries[0].contentRect.width,
            height: entries[0].contentRect.height
          });
        }
      });
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }
  }, []);

  // Fetch Graph Data
  const fetchGraphData = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      };

      // 1. Fetch Clients
      const clientsRes = await fetch(`${SUPABASE_URL}/rest/v1/clients?select=id,name,apps_script_url,created_at`, { headers });
      if (!clientsRes.ok) throw new Error('Failed to fetch clients');
      const clients = await clientsRes.json();

      // 2. Fetch Recruiters
      const recRes = await fetch(`${SUPABASE_URL}/rest/v1/Recruiters`, { headers });
      if (!recRes.ok) throw new Error('Failed to fetch recruiters');
      const recruiters = await recRes.json();

      // 3. Fetch Jobs
      const limitQuery = filterJobCount === 'all' ? '' : `&limit=${filterJobCount}`;
      const jobsRes = await fetch(`${SUPABASE_URL}/rest/v1/jobs?select=id,title,company,source,client,status,location,employmenttype,category,url,dateposted,salary&category=not.is.null&order=extractedat.desc${limitQuery}`, { headers });
      if (!jobsRes.ok) throw new Error('Failed to fetch jobs');
      const jobs = await jobsRes.json();

      const nodesMap = new Map<string, GraphNode>();
      const links: GraphLink[] = [];

      // Add Client Nodes
      clients.forEach((c: any) => {
        if (c.name) {
          nodesMap.set(`client_${c.name}`, {
            id: `client_${c.name}`,
            name: c.name,
            group: 'client',
            val: 35,
            details: c
          });
        }
      });

      // Add Central Recruiter Hub Node
      nodesMap.set('hub_recruiters', {
        id: 'hub_recruiters',
        name: 'All Recruiters',
        group: 'recruiter',
        val: 45,
        details: { description: 'Global Recruiter Hub' }
      });

      // Add Recruiter Nodes and Category Nodes
      recruiters.forEach((r: any) => {
        const name = r['Agency Name'] || r.Name || 'Unknown Recruiter';
        const specialty = r['Primary Specialty'];
        
        // Add Category Node if exists
        if (specialty) {
          const normSpecialty = specialty.trim();
          const catId = `cat_${normSpecialty.toLowerCase()}`;
          if (!nodesMap.has(catId)) {
            nodesMap.set(catId, {
              id: catId,
              name: normSpecialty,
              group: 'category',
              val: 30,
              details: { specialty: normSpecialty }
            });
          }
        }

        if (!nodesMap.has(`rec_${name}`)) {
          nodesMap.set(`rec_${name}`, {
            id: `rec_${name}`,
            name: name,
            group: 'recruiter',
            val: 18,
            details: r
          });
          
          // Link recruiter to central hub
          links.push({ source: `rec_${name}`, target: 'hub_recruiters' });
          
          // Link recruiter to its Category
          if (specialty) {
            links.push({ source: `rec_${name}`, target: `cat_${specialty.trim().toLowerCase()}` });
          }
        }
      });

      // Add Job & Source Nodes
      const sourcesSet = new Set<string>();
      
      jobs.forEach((j: any) => {
        // Job Node
        nodesMap.set(`job_${j.id}`, {
          id: `job_${j.id}`,
          name: j.title || 'Unknown Job',
          group: 'job',
          val: 8,
          details: j
        });

        // Link Job -> Client
        if (j.client) {
          if (nodesMap.has(`client_${j.client}`)) {
            links.push({ source: `job_${j.id}`, target: `client_${j.client}` });
          }
        }

        // Link Job -> Category Node
        if (j.category) {
          const normCategory = j.category.trim();
          const catId = `cat_${normCategory.toLowerCase()}`;
          
          if (!nodesMap.has(catId)) {
            nodesMap.set(catId, {
              id: catId,
              name: normCategory,
              group: 'category',
              val: 30,
              details: { category: normCategory }
            });
          }
          
          links.push({ source: `job_${j.id}`, target: catId });
        }

        // Link Job -> Source
        if (j.source) {
          const sName = j.source.trim();
          if (!sourcesSet.has(sName)) {
            sourcesSet.add(sName);
            nodesMap.set(`src_${sName}`, {
              id: `src_${sName}`,
              name: sName,
              group: 'source',
              val: 20,
              details: { source: sName }
            });
          }
          links.push({ source: `job_${j.id}`, target: `src_${sName}` });
        }
      });

      // Calculate node connectivity degree for authentic organic sizing
      const degreeCounts = new Map<string, number>();
      links.forEach(link => {
        const s = typeof link.source === 'object' ? link.source.id : link.source;
        const t = typeof link.target === 'object' ? link.target.id : link.target;
        degreeCounts.set(s, (degreeCounts.get(s) || 0) + 1);
        degreeCounts.set(t, (degreeCounts.get(t) || 0) + 1);
      });

      nodesMap.forEach((node, id) => {
        node.degree = degreeCounts.get(id) || 1;
      });

      setRawGraphData({
        nodes: Array.from(nodesMap.values()),
        links
      });

    } catch (err) {
      console.error('[Graph] Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraphData();
  }, [filterJobCount]);

  // Filter nodes & links based on visibleGroups
  const filteredData = useMemo(() => {
    const activeNodes = rawGraphData.nodes.filter(n => visibleGroups[n.group]);
    const activeNodeIds = new Set(activeNodes.map(n => n.id));

    const activeLinks = rawGraphData.links.filter(l => {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      return activeNodeIds.has(s) && activeNodeIds.has(t);
    });

    return {
      nodes: activeNodes,
      links: activeLinks
    };
  }, [rawGraphData, visibleGroups]);

  // Search matches set
  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase().trim();
    const matches = new Set<string>();
    filteredData.nodes.forEach(n => {
      if (
        n.name.toLowerCase().includes(q) ||
        (n.details?.company && String(n.details.company).toLowerCase().includes(q)) ||
        (n.details?.category && String(n.details.category).toLowerCase().includes(q))
      ) {
        matches.add(n.id);
      }
    });
    return matches;
  }, [filteredData.nodes, searchQuery]);

  // Apply & Update D3 Physics Forces
  useEffect(() => {
    if (fgRef.current && filteredData.nodes.length > 0) {
      const charge = fgRef.current.d3Force('charge');
      if (charge) {
        charge.strength(repulsionStrength);
        charge.distanceMax(500);
      }

      const link = fgRef.current.d3Force('link');
      if (link) {
        link.distance(linkDistance);
      }

      const center = fgRef.current.d3Force('center');
      if (center) {
        center.strength(centerStrength);
      }

      if (!isPhysicsPaused) {
        fgRef.current.d3ReheatSimulation();
      }
    }
  }, [filteredData, repulsionStrength, linkDistance, centerStrength, isPhysicsPaused]);

  // Freeze / Unfreeze simulation
  const togglePhysics = () => {
    if (!fgRef.current) return;
    if (isPhysicsPaused) {
      fgRef.current.d3ReheatSimulation();
      setIsPhysicsPaused(false);
    } else {
      fgRef.current.pauseAnimation();
      setIsPhysicsPaused(true);
    }
  };

  // Hover highlighting logic
  const handleNodeHover = useCallback((node: GraphNode | null) => {
    setHoverNode(node || null);
    
    if (node) {
      const newHighlightNodes = new Set<string>();
      const newHighlightLinks = new Set<any>();
      
      newHighlightNodes.add(node.id);
      
      filteredData.links.forEach(link => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        
        if (sourceId === node.id || targetId === node.id) {
          newHighlightLinks.add(link);
          newHighlightNodes.add(sourceId);
          newHighlightNodes.add(targetId);
        }
      });
      
      setHighlightNodes(newHighlightNodes);
      setHighlightLinks(newHighlightLinks);
    } else {
      setHighlightNodes(new Set());
      setHighlightLinks(new Set());
    }
  }, [filteredData.links]);

  // Find connected neighbors of a given node (for Inspector)
  const getConnectedNeighbors = useCallback((nodeId: string) => {
    const neighbors: { node: GraphNode; linkId: string }[] = [];
    const seen = new Set<string>();

    filteredData.links.forEach((l, idx) => {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;

      if (s === nodeId && !seen.has(t)) {
        seen.add(t);
        const targetNode = filteredData.nodes.find(n => n.id === t);
        if (targetNode) neighbors.push({ node: targetNode, linkId: `link_${idx}` });
      } else if (t === nodeId && !seen.has(s)) {
        seen.add(s);
        const sourceNode = filteredData.nodes.find(n => n.id === s);
        if (sourceNode) neighbors.push({ node: sourceNode, linkId: `link_${idx}` });
      }
    });

    return neighbors;
  }, [filteredData]);

  // Auto-fit tracking
  const hasAutoFitted = useRef(false);

  useEffect(() => {
    hasAutoFitted.current = false;
  }, [filterJobCount]);

  const fitGraph = useCallback((duration = 800, padding = 80) => {
    if (fgRef.current && filteredData.nodes.length > 0) {
      fgRef.current.zoomToFit(duration, padding);
    }
  }, [filteredData.nodes.length]);

  // Auto-fit on initial simulation stabilization
  const handleEngineStop = useCallback(() => {
    if (!hasAutoFitted.current && fgRef.current && filteredData.nodes.length > 0) {
      fitGraph(800, 80);
      hasAutoFitted.current = true;
    }
  }, [fitGraph, filteredData.nodes.length]);

  // Fallback timer to ensure default framing even before engine fully stops
  useEffect(() => {
    if (filteredData.nodes.length > 0) {
      const timer = setTimeout(() => {
        if (!hasAutoFitted.current && fgRef.current) {
          fitGraph(800, 80);
          hasAutoFitted.current = true;
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [filteredData.nodes.length, fitGraph]);

  // Zoom controls
  const handleZoomIn = () => {
    if (fgRef.current) {
      fgRef.current.zoom(fgRef.current.zoom() * 1.35, 400);
    }
  };

  const handleZoomOut = () => {
    if (fgRef.current) {
      fgRef.current.zoom(fgRef.current.zoom() * 0.75, 400);
    }
  };

  const handleZoomFit = () => {
    fitGraph(600, 80);
  };

  // Center camera on a specific node
  const focusOnNode = (node: GraphNode) => {
    setSelectedNode(node);
    if (fgRef.current && node.x !== undefined && node.y !== undefined) {
      fgRef.current.centerAt(node.x, node.y, 800);
      fgRef.current.zoom(2.2, 800);
    }
  };

  // Canvas node painter supporting both Obsidian dark & light themes
  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const isHovered = hoverNode && hoverNode.id === node.id;
    const isHighlighted = highlightNodes.has(node.id);
    const isSelected = selectedNode && selectedNode.id === node.id;
    const matchesSearch = searchMatches ? searchMatches.has(node.id) : false;

    // Dimming logic: If hovering or searching, dim non-active nodes
    const isDimmed = (hoverNode && !isHighlighted) || (searchMatches && !matchesSearch);
    
    // Dynamic node size based on connectivity degree
    const degree = node.degree || 1;
    const baseRadius = Math.max(2.8, Math.min(18, Math.sqrt(degree) * 2.4));
    const radius = baseRadius * nodeScale;

    // Color based on active theme
    const nodeColor = activeColors[node.group as NodeGroup] || '#94a3b8';

    ctx.save();

    if (isDimmed) {
      ctx.globalAlpha = theme === 'dark' ? 0.08 : 0.12;
    }

    // Outer Glow / Ring for highlighted, selected, or search matching nodes
    if (isHovered || isSelected || matchesSearch) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius + 4 / globalScale, 0, 2 * Math.PI);
      ctx.strokeStyle = isSelected ? (theme === 'dark' ? '#ffffff' : '#0f172a') : (matchesSearch ? '#f59e0b' : nodeColor);
      ctx.lineWidth = 2 / globalScale;
      ctx.stroke();

      ctx.shadowBlur = theme === 'dark' ? 14 : 8;
      ctx.shadowColor = theme === 'dark' ? nodeColor : 'rgba(0,0,0,0.2)';
    } else if (isHighlighted) {
      ctx.shadowBlur = theme === 'dark' ? 10 : 6;
      ctx.shadowColor = theme === 'dark' ? nodeColor : 'rgba(0,0,0,0.15)';
    } else {
      ctx.shadowBlur = 0;
    }

    // Node Body
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = nodeColor;
    ctx.fill();

    // Node edge ring
    ctx.lineWidth = 0.8 / globalScale;
    ctx.strokeStyle = theme === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.15)';
    ctx.stroke();

    // Text Label rendering
    const shouldDrawLabel = 
      isHovered || 
      isSelected || 
      matchesSearch || 
      labelMode === 'always' || 
      (labelMode === 'zoom' && (globalScale > 1.3 || radius > 8));

    if (shouldDrawLabel && !isDimmed) {
      const label = node.name || 'Unnamed';
      const fontSize = Math.max(9, Math.min(14, (isHovered || isSelected ? 13 : 10) / globalScale));
      
      ctx.font = `${isHovered || isSelected ? '600' : '500'} ${fontSize}px Inter, -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const labelY = node.y + radius + 3 / globalScale;

      // Text stroke halo for legibility
      ctx.strokeStyle = theme === 'dark' ? '#090a0f' : '#ffffff';
      ctx.lineWidth = 3 / globalScale;
      ctx.lineJoin = 'round';
      ctx.strokeText(label, node.x, labelY);

      // Main text color
      ctx.fillStyle = theme === 'dark'
        ? (isHovered || isSelected ? '#ffffff' : '#e2e8f0')
        : (isHovered || isSelected ? '#0f172a' : '#334155');
      ctx.fillText(label, node.x, labelY);
    }

    ctx.restore();
  }, [hoverNode, highlightNodes, selectedNode, searchMatches, labelMode, nodeScale, theme, activeColors]);

  // Dynamic link color and thickness
  const getLinkColor = useCallback((link: any) => {
    const isHighlighted = highlightLinks.has(link);
    if (theme === 'dark') {
      if (hoverNode) {
        return isHighlighted ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.02)';
      }
      if (searchMatches) {
        return 'rgba(255, 255, 255, 0.04)';
      }
      return 'rgba(255, 255, 255, 0.12)';
    } else {
      // Light theme link styles
      if (hoverNode) {
        return isHighlighted ? 'rgba(15, 23, 42, 0.85)' : 'rgba(148, 163, 184, 0.05)';
      }
      if (searchMatches) {
        return 'rgba(148, 163, 184, 0.08)';
      }
      return 'rgba(148, 163, 184, 0.3)';
    }
  }, [hoverNode, highlightLinks, searchMatches, theme]);

  const getLinkWidth = useCallback((link: any) => {
    const isHighlighted = highlightLinks.has(link);
    return (isHighlighted ? 2.4 : linkThickness);
  }, [highlightLinks, linkThickness]);

  // Count nodes by group
  const groupCounts = useMemo(() => {
    const counts: Record<NodeGroup, number> = {
      client: 0,
      recruiter: 0,
      category: 0,
      job: 0,
      source: 0,
    };
    rawGraphData.nodes.forEach(n => {
      if (counts[n.group] !== undefined) counts[n.group]++;
    });
    return counts;
  }, [rawGraphData.nodes]);

  const isDark = theme === 'dark';

  return (
    <div className={`h-full w-full flex flex-col relative overflow-hidden font-sans select-none transition-colors duration-300 ${
      isDark ? 'bg-[#141416] text-zinc-100' : 'bg-[#f8fafc] text-slate-800'
    }`} style={{ minHeight: 'calc(100vh - 65px)' }}>
      
      {/* TOP FLOATING BAR: Brand Pill + Quick Legends */}
      <div className="absolute top-4 left-4 z-10 flex flex-col sm:flex-row items-start sm:items-center gap-3 pointer-events-none">
        {/* Title Badge */}
        <div className={`px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-3 pointer-events-auto backdrop-blur-xl border transition-all ${
          isDark 
            ? 'bg-zinc-900/80 border-zinc-800/80 text-white shadow-black/40' 
            : 'bg-white/90 border-slate-200 text-slate-900 shadow-slate-200/60'
        }`}>
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm tracking-tight">Knowledge Graph</span>
              <span className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded border ${
                isDark 
                  ? 'bg-zinc-800 text-zinc-400 border-zinc-700/50' 
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}>
                Network Map
              </span>
            </div>
            <p className={`text-[11px] mt-0.5 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
              {filteredData.nodes.length} nodes · {filteredData.links.length} connections
            </p>
          </div>
        </div>

        {/* Interactive Group Legend Pills (Click to toggle group visibility) */}
        <div className={`px-3 py-1.5 rounded-2xl shadow-xl flex flex-wrap items-center gap-2 pointer-events-auto backdrop-blur-xl border transition-all ${
          isDark 
            ? 'bg-zinc-900/70 border-zinc-800/70 shadow-black/30' 
            : 'bg-white/85 border-slate-200 shadow-slate-200/50'
        }`}>
          {(['client', 'recruiter', 'category', 'job', 'source'] as NodeGroup[]).map(group => {
            const isVisible = visibleGroups[group];
            const color = activeColors[group];
            const label = group === 'client' ? 'Clients' :
                          group === 'recruiter' ? 'Recruiters' :
                          group === 'category' ? 'Categories' :
                          group === 'job' ? 'Jobs' : 'Sources';
            return (
              <button
                key={group}
                onClick={() => setVisibleGroups(prev => ({ ...prev, [group]: !prev[group] }))}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium transition-all ${
                  isVisible 
                    ? (isDark 
                        ? 'bg-zinc-800/80 text-zinc-200 hover:bg-zinc-700/80 border border-zinc-700/50' 
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200')
                    : (isDark 
                        ? 'bg-zinc-900/40 text-zinc-500 opacity-50 line-through border border-transparent' 
                        : 'bg-slate-50 text-slate-400 opacity-50 line-through border border-transparent')
                }`}
                title={`Toggle ${label} visibility`}
              >
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: isVisible ? color : '#94a3b8', boxShadow: isVisible ? `0 0 8px ${color}88` : 'none' }} 
                />
                <span>{label}</span>
                <span className={`text-[10px] font-mono ${isDark ? 'text-zinc-400' : 'text-slate-400'}`}>({groupCounts[group]})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TOP-RIGHT CONTROLS: Theme Toggle, Dataset Limit & Settings */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2 pointer-events-auto">
        {/* Theme Switcher Button */}
        <button
          onClick={toggleTheme}
          className={`p-2 rounded-xl backdrop-blur-xl border transition-all shadow-xl flex items-center justify-center ${
            isDark 
              ? 'bg-zinc-900/80 border-zinc-800/80 text-amber-400 hover:bg-zinc-800 hover:text-amber-300' 
              : 'bg-white/90 border-slate-200 text-indigo-600 hover:bg-slate-100 hover:text-indigo-700'
          }`}
          title={isDark ? "Switch to Light Theme" : "Switch to Obsidian Dark Theme"}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Dataset Limit Selector */}
        <select 
          value={filterJobCount}
          onChange={(e) => setFilterJobCount(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className={`backdrop-blur-xl border rounded-xl px-3.5 py-2 text-xs font-medium shadow-xl outline-none cursor-pointer transition-colors ${
            isDark 
              ? 'bg-zinc-900/80 border-zinc-800/80 text-zinc-200 focus:border-zinc-500' 
              : 'bg-white/90 border-slate-200 text-slate-700 focus:border-slate-400'
          }`}
        >
          <option value="all">All Categorized Jobs</option>
          <option value={100}>Last 100 Jobs</option>
          <option value={500}>Last 500 Jobs</option>
          <option value={1000}>Last 1000 Jobs</option>
        </select>

        {/* Settings Toggle Button */}
        <button
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          className={`p-2 rounded-xl backdrop-blur-xl border transition-all shadow-xl ${
            isSettingsOpen 
              ? 'bg-primary-500/20 border-primary-500 text-primary-400' 
              : (isDark 
                  ? 'bg-zinc-900/80 border-zinc-800/80 text-zinc-300 hover:bg-zinc-800' 
                  : 'bg-white/90 border-slate-200 text-slate-700 hover:bg-slate-100')
          }`}
          title="Graph Settings"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* BOTTOM-RIGHT FLOATING HUD: Zoom & Simulation Tools */}
      <div className={`absolute bottom-6 right-6 z-10 flex items-center gap-1.5 backdrop-blur-xl border p-1.5 rounded-2xl shadow-2xl pointer-events-auto transition-all ${
        isDark 
          ? 'bg-zinc-900/80 border-zinc-800/80 shadow-black/40' 
          : 'bg-white/90 border-slate-200 shadow-slate-300/60'
      }`}>
        <button
          onClick={handleZoomIn}
          className={`p-2 rounded-xl transition-colors ${
            isDark ? 'hover:bg-zinc-800 text-zinc-300 hover:text-white' : 'hover:bg-slate-100 text-slate-700 hover:text-slate-900'
          }`}
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className={`p-2 rounded-xl transition-colors ${
            isDark ? 'hover:bg-zinc-800 text-zinc-300 hover:text-white' : 'hover:bg-slate-100 text-slate-700 hover:text-slate-900'
          }`}
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className={`w-[1px] h-4 mx-0.5 ${isDark ? 'bg-zinc-800' : 'bg-slate-200'}`} />
        <button
          onClick={handleZoomFit}
          className={`p-2 rounded-xl transition-colors ${
            isDark ? 'hover:bg-zinc-800 text-zinc-300 hover:text-white' : 'hover:bg-slate-100 text-slate-700 hover:text-slate-900'
          }`}
          title="Fit Graph to View"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <button
          onClick={togglePhysics}
          className={`p-2 rounded-xl transition-colors ${
            isPhysicsPaused 
              ? 'text-amber-500 bg-amber-500/10 hover:bg-amber-500/20' 
              : (isDark ? 'text-zinc-300 hover:bg-zinc-800 hover:text-white' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900')
          }`}
          title={isPhysicsPaused ? "Resume Simulation" : "Freeze / Pause Physics"}
        >
          {isPhysicsPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
        </button>
      </div>

      {/* GRAPH SETTINGS DRAWER */}
      {isSettingsOpen && (
        <div className={`absolute top-16 right-4 z-20 w-80 backdrop-blur-2xl border rounded-2xl shadow-2xl p-4 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-200 max-h-[calc(100vh-100px)] overflow-y-auto transition-all ${
          isDark 
            ? 'bg-zinc-900/95 border-zinc-800 text-zinc-100 shadow-black/50' 
            : 'bg-white/95 border-slate-200 text-slate-800 shadow-slate-300/60'
        }`}>
          <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-zinc-800' : 'border-slate-200'}`}>
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-primary-500" />
              <span className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>Graph Settings</span>
            </div>
            <button 
              onClick={() => setIsSettingsOpen(false)}
              className={`p-1 rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-700'}`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Theme Switcher inside Settings */}
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>Theme Mode</span>
            <button
              onClick={toggleTheme}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                isDark 
                  ? 'bg-zinc-800 text-amber-400 border-zinc-700 hover:bg-zinc-700' 
                  : 'bg-slate-100 text-indigo-600 border-slate-200 hover:bg-slate-200'
              }`}
            >
              {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              <span>{isDark ? 'Obsidian Dark' : 'Light Theme'}</span>
            </button>
          </div>

          {/* Search Filter Input */}
          <div className="flex flex-col gap-1.5">
            <label className={`text-xs font-semibold flex items-center justify-between ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
              <span>Search Node / Keyword</span>
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className={`text-[10px] ${isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-slate-400 hover:text-slate-600'}`}>
                  Clear
                </button>
              )}
            </label>
            <div className="relative">
              <Search className={`w-3.5 h-3.5 absolute left-3 top-2.5 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`} />
              <input 
                type="text" 
                placeholder="Type title, company, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full rounded-xl pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:border-primary-500 border transition-colors ${
                  isDark 
                    ? 'bg-zinc-950/60 border-zinc-800 text-zinc-200 placeholder-zinc-500' 
                    : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'
                }`}
              />
            </div>
            {searchMatches && (
              <span className="text-[11px] text-amber-500 font-medium">
                {searchMatches.size} nodes matching "{searchQuery}"
              </span>
            )}
          </div>

          {/* Display Controls */}
          <div className={`flex flex-col gap-3 pt-2 border-t ${isDark ? 'border-zinc-800/80' : 'border-slate-200'}`}>
            <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>Display</span>

            {/* Label Mode */}
            <div className="flex flex-col gap-1.5">
              <label className={`text-xs ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>Text Labels</label>
              <div className={`grid grid-cols-3 gap-1 p-1 rounded-xl border ${
                isDark ? 'bg-zinc-950/60 border-zinc-800' : 'bg-slate-50 border-slate-200'
              }`}>
                {(['hover', 'zoom', 'always'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setLabelMode(mode)}
                    className={`py-1 text-[11px] font-medium rounded-lg capitalize transition-all ${
                      labelMode === mode 
                        ? (isDark ? 'bg-zinc-800 text-white shadow-sm' : 'bg-white text-slate-900 shadow-sm border border-slate-200/60')
                        : (isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-slate-500 hover:text-slate-700')
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Node Size Slider */}
            <div className="flex flex-col gap-1">
              <div className={`flex justify-between text-xs ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                <span>Node Scale</span>
                <span className={`font-mono ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>{nodeScale.toFixed(1)}x</span>
              </div>
              <input 
                type="range" 
                min="0.5" 
                max="2.5" 
                step="0.1"
                value={nodeScale}
                onChange={(e) => setNodeScale(parseFloat(e.target.value))}
                className="accent-primary-500 rounded-lg cursor-pointer h-1.5"
              />
            </div>

            {/* Link Thickness Slider */}
            <div className="flex flex-col gap-1">
              <div className={`flex justify-between text-xs ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                <span>Link Thickness</span>
                <span className={`font-mono ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>{linkThickness.toFixed(1)}px</span>
              </div>
              <input 
                type="range" 
                min="0.5" 
                max="3.0" 
                step="0.1"
                value={linkThickness}
                onChange={(e) => setLinkThickness(parseFloat(e.target.value))}
                className="accent-primary-500 rounded-lg cursor-pointer h-1.5"
              />
            </div>
          </div>

          {/* Physics Forces Controls */}
          <div className={`flex flex-col gap-3 pt-2 border-t ${isDark ? 'border-zinc-800/80' : 'border-slate-200'}`}>
            <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>Forces</span>

            {/* Repulsion Force */}
            <div className="flex flex-col gap-1">
              <div className={`flex justify-between text-xs ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                <span>Repel Force</span>
                <span className={`font-mono ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>{repulsionStrength}</span>
              </div>
              <input 
                type="range" 
                min="-200" 
                max="-15" 
                step="5"
                value={repulsionStrength}
                onChange={(e) => setRepulsionStrength(parseInt(e.target.value))}
                className="accent-primary-500 rounded-lg cursor-pointer h-1.5"
              />
            </div>

            {/* Link Distance */}
            <div className="flex flex-col gap-1">
              <div className={`flex justify-between text-xs ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                <span>Link Distance</span>
                <span className={`font-mono ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>{linkDistance}</span>
              </div>
              <input 
                type="range" 
                min="30" 
                max="180" 
                step="5"
                value={linkDistance}
                onChange={(e) => setLinkDistance(parseInt(e.target.value))}
                className="accent-primary-500 rounded-lg cursor-pointer h-1.5"
              />
            </div>

            {/* Center Gravity */}
            <div className="flex flex-col gap-1">
              <div className={`flex justify-between text-xs ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                <span>Center Gravity</span>
                <span className={`font-mono ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>{centerStrength.toFixed(2)}</span>
              </div>
              <input 
                type="range" 
                min="0.05" 
                max="0.5" 
                step="0.02"
                value={centerStrength}
                onChange={(e) => setCenterStrength(parseFloat(e.target.value))}
                className="accent-primary-500 rounded-lg cursor-pointer h-1.5"
              />
            </div>

            <button
              onClick={() => {
                setRepulsionStrength(-60);
                setLinkDistance(75);
                setCenterStrength(0.15);
                setNodeScale(1.1);
                setLinkThickness(1.2);
                if (fgRef.current) fgRef.current.d3ReheatSimulation();
              }}
              className={`mt-1 py-1.5 text-xs font-medium rounded-xl flex items-center justify-center gap-1.5 transition-colors ${
                isDark 
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Forces</span>
            </button>
          </div>
        </div>
      )}

      {/* MAIN GRAPH CANVAS AREA */}
      <div className="flex-1 w-full relative h-full" ref={containerRef}>
        {loading && (
          <div className={`absolute inset-0 z-20 flex flex-col items-center justify-center backdrop-blur-md transition-colors ${
            isDark ? 'bg-[#141416]/80' : 'bg-slate-50/80'
          }`}>
            <div className={`w-12 h-12 rounded-2xl border shadow-2xl flex items-center justify-center animate-pulse ${
              isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'
            }`}>
              <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
            </div>
            <p className={`mt-4 text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>Loading Network Graph...</p>
          </div>
        )}
        
        {error && (
          <div className={`absolute inset-0 z-20 flex items-center justify-center ${isDark ? 'bg-[#141416]' : 'bg-slate-50'}`}>
            <div className={`p-5 rounded-2xl flex items-center gap-3 border max-w-md ${
              isDark ? 'bg-red-950/40 border-red-800/60' : 'bg-red-50 border-red-200'
            }`}>
              <AlertCircle className="text-red-500 w-5 h-5 shrink-0" />
              <p className={`text-xs ${isDark ? 'text-red-300' : 'text-red-700'}`}>{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && filteredData.nodes.length > 0 && (
          <ForceGraph2D
            ref={fgRef as any}
            width={dimensions.width}
            height={dimensions.height}
            graphData={filteredData}
            backgroundColor={isDark ? '#141416' : '#f8fafc'}
            nodeRelSize={1}
            nodeCanvasObject={paintNode}
            linkColor={getLinkColor}
            linkWidth={getLinkWidth}
            onNodeHover={handleNodeHover as any}
            onNodeClick={(node: any) => focusOnNode(node as GraphNode)}
            cooldownTicks={120}
            d3AlphaDecay={0.025}
            d3VelocityDecay={0.25}
            onEngineStop={handleEngineStop}
          />
        )}
      </div>

      {/* NODE INSPECTOR (Side Slide-over Drawer) */}
      <div className={`absolute top-0 right-0 bottom-0 w-84 sm:w-96 backdrop-blur-2xl border-l transition-transform duration-300 ease-in-out z-30 shadow-2xl flex flex-col ${
        selectedNode ? 'translate-x-0' : 'translate-x-full'
      } ${
        isDark 
          ? 'bg-zinc-900/95 border-zinc-800 text-zinc-100 shadow-black/50' 
          : 'bg-white/95 border-slate-200 text-slate-800 shadow-slate-300/50'
      }`}>
        {selectedNode && (
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className={`p-4 border-b flex items-center justify-between ${isDark ? 'border-zinc-800' : 'border-slate-200'}`}>
              <div className="flex items-center gap-2">
                <span 
                  className="w-2.5 h-2.5 rounded-full" 
                  style={{ backgroundColor: activeColors[selectedNode.group] }} 
                />
                <span className={`text-[11px] font-mono uppercase tracking-wider font-semibold ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                  {selectedNode.group}
                </span>
                <span className={`text-xs ${isDark ? 'text-zinc-600' : 'text-slate-300'}`}>·</span>
                <span className={`text-xs font-mono ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                  {selectedNode.degree || 1} {selectedNode.degree === 1 ? 'connection' : 'connections'}
                </span>
              </div>
              <button 
                onClick={() => setSelectedNode(null)} 
                className={`p-1 rounded-lg transition-colors ${
                  isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Content Body */}
            <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-6">
              <div>
                <h3 className={`text-lg font-bold tracking-tight leading-snug ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {selectedNode.name}
                </h3>
                
                {selectedNode.details?.url && (
                  <a 
                    href={selectedNode.details.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-2 text-xs text-primary-500 hover:text-primary-600 hover:underline"
                  >
                    <span>View Listing / Source URL</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              {/* Connected Neighbors (Obsidian Links) */}
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                    Connected Nodes
                  </span>
                  <span className={`text-xs font-mono ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                    {getConnectedNeighbors(selectedNode.id).length}
                  </span>
                </div>

                <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
                  {getConnectedNeighbors(selectedNode.id).map(({ node: neighbor }) => (
                    <button
                      key={neighbor.id}
                      onClick={() => focusOnNode(neighbor)}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between group ${
                        isDark 
                          ? 'bg-zinc-950/50 hover:bg-zinc-800/80 border-zinc-800/60 hover:border-zinc-700' 
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200/80 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <div 
                          className="w-2 h-2 rounded-full shrink-0" 
                          style={{ backgroundColor: activeColors[neighbor.group] }} 
                        />
                        <span className={`text-xs font-medium truncate ${
                          isDark ? 'text-zinc-200 group-hover:text-white' : 'text-slate-700 group-hover:text-slate-900'
                        }`}>
                          {neighbor.name}
                        </span>
                      </div>
                      <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-transform group-hover:translate-x-0.5 ${
                        isDark ? 'text-zinc-600 group-hover:text-zinc-300' : 'text-slate-400 group-hover:text-slate-600'
                      }`} />
                    </button>
                  ))}
                  {getConnectedNeighbors(selectedNode.id).length === 0 && (
                    <p className={`text-xs italic py-2 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>No active connections found for this node.</p>
                  )}
                </div>
              </div>

              {/* Node Metadata Badges */}
              <div className={`flex flex-col gap-3 pt-4 border-t ${isDark ? 'border-zinc-800/80' : 'border-slate-200'}`}>
                <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>Properties</span>
                
                <div className="flex flex-col gap-2">
                  {Object.entries(selectedNode.details || {}).map(([key, value]) => {
                    if (!value || typeof value === 'object' || key === 'url' || key === 'description') return null;
                    return (
                      <div key={key} className={`p-2.5 rounded-xl border ${
                        isDark ? 'bg-zinc-950/40 border-zinc-800/50' : 'bg-slate-50 border-slate-200/60'
                      }`}>
                        <p className={`text-[10px] uppercase font-mono tracking-wider font-semibold mb-0.5 ${
                          isDark ? 'text-zinc-500' : 'text-slate-400'
                        }`}>
                          {key.replace(/_/g, ' ')}
                        </p>
                        <p className={`text-xs font-medium break-words ${
                          isDark ? 'text-zinc-200' : 'text-slate-700'
                        }`}>
                          {String(value)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
