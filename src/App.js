import React, { useState, useEffect, useCallback } from 'react'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragOverlay
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from './supabase'
import {
  Plus, Check, Grip, Tag, Folder, Calendar, ChevronDown,
  ChevronRight, X, Edit2, Trash2, Filter, Sun, LayoutList,
  Clock, AlertCircle, Circle, CheckCircle2, Star
} from 'lucide-react'
import {
  format, isToday, isTomorrow, isThisWeek, isThisMonth,
  startOfDay, parseISO, isPast, addDays
} from 'date-fns'
import './App.css'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PRIORITY_CONFIG = {
  high:   { label: 'High',   color: '#ff4d4d', icon: '●' },
  medium: { label: 'Medium', color: '#f59e0b', icon: '●' },
  low:    { label: 'Low',    color: '#6b7280', icon: '●' },
}

const dueDateLabel = (dateStr) => {
  if (!dateStr) return null
  const d = parseISO(dateStr)
  if (isToday(d)) return { label: 'Today', urgent: true }
  if (isTomorrow(d)) return { label: 'Tomorrow', urgent: false }
  if (isPast(d)) return { label: format(d, 'MMM d'), urgent: true, overdue: true }
  if (isThisWeek(d)) return { label: format(d, 'EEE'), urgent: false }
  return { label: format(d, 'MMM d'), urgent: false }
}

// ─── Sortable Todo Item ────────────────────────────────────────────────────────
function SortableTodoItem({ todo, projects, categories, onToggle, onDelete, onEdit }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: todo.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  return (
    <div ref={setNodeRef} style={style}>
      <TodoItem
        todo={todo} projects={projects} categories={categories}
        onToggle={onToggle} onDelete={onDelete} onEdit={onEdit}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  )
}

// ─── Todo Item ─────────────────────────────────────────────────────────────────
function TodoItem({ todo, projects, categories, onToggle, onDelete, onEdit, dragHandleProps }) {
  const project = projects.find(p => p.id === todo.project_id)
  const category = categories.find(c => c.id === todo.category_id)
  const dueInfo = dueDateLabel(todo.due_date)
  const prio = PRIORITY_CONFIG[todo.priority] || PRIORITY_CONFIG.medium

  return (
    <div className={`todo-item ${todo.completed ? 'completed' : ''} priority-${todo.priority}`}>
      <div className="todo-drag-handle" {...dragHandleProps}>
        <Grip size={14} />
      </div>

      <button className="todo-check" onClick={() => onToggle(todo)}>
        {todo.completed
          ? <CheckCircle2 size={18} className="check-done" />
          : <Circle size={18} className="check-empty" />
        }
      </button>

      <div className="todo-body" onClick={() => onEdit(todo)}>
        <div className="todo-title-row">
          <span className="todo-prio-dot" style={{ color: prio.color }}>{prio.icon}</span>
          <span className="todo-title">{todo.title}</span>
          {todo.notes && <span className="todo-has-notes" title={todo.notes}>…</span>}
        </div>

        <div className="todo-meta">
          {project && (
            <span className="todo-badge project-badge" style={{ '--badge-color': project.color }}>
              <span className="badge-icon">{project.icon}</span> {project.name}
            </span>
          )}
          {category && (
            <span className="todo-badge category-badge" style={{ '--badge-color': category.color }}>
              {category.name}
            </span>
          )}
          {(todo.tags || []).map(tag => (
            <span key={tag} className="todo-badge tag-badge">#{tag}</span>
          ))}
          {dueInfo && (
            <span className={`todo-badge due-badge ${dueInfo.overdue ? 'overdue' : dueInfo.urgent ? 'urgent' : ''}`}>
              <Clock size={10} /> {dueInfo.label}
            </span>
          )}
        </div>
      </div>

      <div className="todo-actions">
        <button className="icon-btn" onClick={() => onEdit(todo)}><Edit2 size={13} /></button>
        <button className="icon-btn danger" onClick={() => onDelete(todo.id)}><Trash2 size={13} /></button>
      </div>
    </div>
  )
}

// ─── Todo Modal ────────────────────────────────────────────────────────────────
function TodoModal({ todo, projects, categories, onSave, onClose }) {
  const [form, setForm] = useState({
    title: todo?.title || '',
    notes: todo?.notes || '',
    due_date: todo?.due_date || '',
    project_id: todo?.project_id || '',
    category_id: todo?.category_id || '',
    priority: todo?.priority || 'medium',
    tags: (todo?.tags || []).join(', '),
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = () => {
    if (!form.title.trim()) return
    onSave({
      ...form,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      project_id: form.project_id || null,
      category_id: form.category_id || null,
      due_date: form.due_date || null,
    })
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span>{todo?.id ? 'Edit Task' : 'New Task'}</span>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body">
          <input
            className="modal-title-input"
            placeholder="What needs to be done?"
            value={form.title}
            onChange={e => set('title', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            autoFocus
          />

          <textarea
            className="modal-notes"
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            rows={2}
          />

          <div className="modal-row">
            <div className="modal-field">
              <label>Due Date</label>
              <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
            </div>
            <div className="modal-field">
              <label>Priority</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value)}>
                <option value="high">🔴 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">⚪ Low</option>
              </select>
            </div>
          </div>

          <div className="modal-row">
            <div className="modal-field">
              <label>Project</label>
              <select value={form.project_id} onChange={e => set('project_id', e.target.value)}>
                <option value="">No Project</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}
              </select>
            </div>
            <div className="modal-field">
              <label>Category</label>
              <select value={form.category_id} onChange={e => set('category_id', e.target.value)}>
                <option value="">No Category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="modal-field">
            <label>Tags (comma separated)</label>
            <input
              placeholder="e.g. urgent, review, design"
              value={form.tags}
              onChange={e => set('tags', e.target.value)}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>
            {todo?.id ? 'Save Changes' : 'Add Task'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Group Section ─────────────────────────────────────────────────────────────
function TodoGroup({ title, todos, projects, categories, onToggle, onDelete, onEdit, onDragEnd, badge, accent }) {
  const [collapsed, setCollapsed] = useState(false)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  if (todos.length === 0) return null

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIdx = todos.findIndex(t => t.id === active.id)
      const newIdx = todos.findIndex(t => t.id === over.id)
      onDragEnd(todos, arrayMove(todos, oldIdx, newIdx))
    }
  }

  return (
    <div className="todo-group">
      <div className="group-header" onClick={() => setCollapsed(c => !c)} style={{ '--accent': accent || '#6366f1' }}>
        <div className="group-header-left">
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          <span className="group-title">{title}</span>
          <span className="group-count">{todos.filter(t => !t.completed).length}</span>
        </div>
        {badge && <span className="group-badge">{badge}</span>}
      </div>

      {!collapsed && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={todos.map(t => t.id)} strategy={verticalListSortingStrategy}>
            <div className="todo-list">
              {todos.map(todo => (
                <SortableTodoItem
                  key={todo.id} todo={todo}
                  projects={projects} categories={categories}
                  onToggle={onToggle} onDelete={onDelete} onEdit={onEdit}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}

// ─── Quick Add Bar ─────────────────────────────────────────────────────────────
function QuickAdd({ onAdd }) {
  const [val, setVal] = useState('')
  const submit = () => {
    if (!val.trim()) return
    onAdd(val.trim())
    setVal('')
  }
  return (
    <div className="quick-add">
      <Plus size={16} className="quick-add-icon" />
      <input
        placeholder="Add a task... (press Enter)"
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
      />
      {val && <button className="btn-primary small" onClick={submit}>Add</button>}
    </div>
  )
}

// ─── Setup Screen ──────────────────────────────────────────────────────────────
function SetupScreen({ onConnect }) {
  const [url, setUrl] = useState('')
  const [key, setKey] = useState('')
  return (
    <div className="setup-screen">
      <div className="setup-card">
        <div className="setup-logo">upnext</div>
        <p className="setup-sub">Connect your Supabase project to sync across all your devices.</p>

        <div className="setup-steps">
          <div className="setup-step">
            <span className="step-num">1</span>
            <span>Go to <a href="https://supabase.com" target="_blank" rel="noreferrer">supabase.com</a> → create a free project</span>
          </div>
          <div className="setup-step">
            <span className="step-num">2</span>
            <span>Open <strong>SQL Editor</strong> → paste & run <code>SUPABASE_SCHEMA.sql</code></span>
          </div>
          <div className="setup-step">
            <span className="step-num">3</span>
            <span>Go to <strong>Settings → API</strong> → copy your URL and anon key below</span>
          </div>
        </div>

        <div className="setup-fields">
          <input placeholder="Project URL (https://xxx.supabase.co)" value={url} onChange={e => setUrl(e.target.value)} />
          <input placeholder="Anon Public Key" value={key} onChange={e => setKey(e.target.value)} type="password" />
        </div>

        <button className="btn-primary full" onClick={() => onConnect(url, key)} disabled={!url || !key}>
          Connect & Launch →
        </button>
      </div>
    </div>
  )
}

// ─── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [connected, setConnected] = useState(false)
  const [todos, setTodos] = useState([])
  const [projects, setProjects] = useState([])
  const [categories, setCategories] = useState([])
  const [view, setView] = useState('today') // today | all | week | month | project-{id}
  const [modal, setModal] = useState(null)   // null | 'new' | todo object
  const [filter, setFilter] = useState({ category: '', priority: '', tag: '' })
  const [loading, setLoading] = useState(true)

  // ── Check if we have stored credentials
  useEffect(() => {
    const url = localStorage.getItem('upnext_url')
    const key = localStorage.getItem('upnext_key')
    if (url && key && url !== 'YOUR_SUPABASE_URL') {
      setConnected(true)
    } else if (process.env.REACT_APP_SUPABASE_URL && process.env.REACT_APP_SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
      setConnected(true)
    } else {
      setLoading(false)
    }
  }, [])

  const handleConnect = (url, key) => {
    localStorage.setItem('upnext_url', url)
    localStorage.setItem('upnext_key', key)
    window.location.reload()
  }

  // ── Load data
  useEffect(() => {
    if (!connected) return
    Promise.all([
      supabase.from('todos').select('*').order('sort_order').order('created_at'),
      supabase.from('projects').select('*').order('created_at'),
      supabase.from('categories').select('*').order('name'),
    ]).then(([t, p, c]) => {
      if (t.data) setTodos(t.data)
      if (p.data) setProjects(p.data)
      if (c.data) setCategories(c.data)
      setLoading(false)
    })
  }, [connected])

  // ── Realtime subscription
  useEffect(() => {
    if (!connected) return
    const channel = supabase.channel('todos-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todos' }, payload => {
        if (payload.eventType === 'INSERT') setTodos(t => [...t, payload.new])
        if (payload.eventType === 'UPDATE') setTodos(t => t.map(x => x.id === payload.new.id ? payload.new : x))
        if (payload.eventType === 'DELETE') setTodos(t => t.filter(x => x.id !== payload.old.id))
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [connected])

  // ── CRUD
  const addTodo = async (titleOrObj) => {
    const newTodo = typeof titleOrObj === 'string'
      ? { title: titleOrObj, priority: 'medium', tags: [], sort_order: todos.length }
      : { ...titleOrObj, sort_order: todos.length }

    if (view.startsWith('project-')) newTodo.project_id = view.replace('project-', '')
    if (view === 'today') newTodo.due_date = format(new Date(), 'yyyy-MM-dd')

    const { data } = await supabase.from('todos').insert(newTodo).select().single()
    if (data) setTodos(t => [...t, data])
    setModal(null)
  }

  const updateTodo = async (updated) => {
    const { data } = await supabase.from('todos').update(updated).eq('id', updated.id).select().single()
    if (data) setTodos(t => t.map(x => x.id === data.id ? data : x))
    setModal(null)
  }

  const toggleTodo = async (todo) => {
    const updated = { ...todo, completed: !todo.completed }
    await supabase.from('todos').update({ completed: updated.completed }).eq('id', todo.id)
    setTodos(t => t.map(x => x.id === todo.id ? updated : x))
  }

  const deleteTodo = async (id) => {
    await supabase.from('todos').delete().eq('id', id)
    setTodos(t => t.filter(x => x.id !== id))
  }

  const saveTodo = (form) => {
    if (modal?.id) updateTodo({ ...modal, ...form })
    else addTodo(form)
  }

  const handleDragEnd = async (group, reordered) => {
    setTodos(prev => {
      const ids = group.map(t => t.id)
      const next = prev.filter(t => !ids.includes(t.id))
      return [...next, ...reordered]
    })
    const updates = reordered.map((t, i) => supabase.from('todos').update({ sort_order: i }).eq('id', t.id))
    await Promise.all(updates)
  }

  // ── Filter & view logic
  const filteredTodos = todos.filter(t => {
    if (filter.category && t.category_id !== filter.category) return false
    if (filter.priority && t.priority !== filter.priority) return false
    if (filter.tag && !(t.tags || []).includes(filter.tag)) return false
    return true
  })

  const getViewTodos = () => {
    const active = filteredTodos.filter(t => !t.completed)
    const done = filteredTodos.filter(t => t.completed)

    if (view === 'today') {
      const today = format(new Date(), 'yyyy-MM-dd')
      const todayTodos = active.filter(t => t.due_date === today)
      const doneTodayTodos = done.filter(t => t.due_date === today)
      return { type: 'flat', active: todayTodos, done: doneTodayTodos }
    }

    if (view === 'week') {
      const groups = {}
      const order = []
      for (let i = 0; i < 7; i++) {
        const d = addDays(new Date(), i)
        const key = format(d, 'yyyy-MM-dd')
        const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : format(d, 'EEEE, MMM d')
        groups[key] = { label, todos: [], accent: i === 0 ? '#ff6b35' : '#6366f1' }
        order.push(key)
      }
      groups['no-date'] = { label: 'No Due Date', todos: [], accent: '#6b7280' }
      order.push('no-date')

      active.forEach(t => {
        const key = t.due_date && groups[t.due_date] ? t.due_date : 'no-date'
        groups[key].todos.push(t)
      })
      return { type: 'grouped', groups: order.map(k => groups[k]) }
    }

    if (view === 'month') {
      const thisMonth = active.filter(t => t.due_date && isThisMonth(parseISO(t.due_date)))
      const noDate = active.filter(t => !t.due_date)
      return {
        type: 'grouped',
        groups: [
          { label: 'This Month', todos: thisMonth, accent: '#6366f1' },
          { label: 'No Due Date', todos: noDate, accent: '#6b7280' },
        ]
      }
    }

    if (view.startsWith('project-')) {
      const pid = view.replace('project-', '')
      const projectTodos = active.filter(t => t.project_id === pid)
      const doneProjTodos = done.filter(t => t.project_id === pid)
      return { type: 'flat', active: projectTodos, done: doneProjTodos }
    }

    // all
    const byProject = {}
    projects.forEach(p => { byProject[p.id] = { label: `${p.icon} ${p.name}`, todos: [], accent: p.color } })
    byProject['none'] = { label: 'Inbox', todos: [], accent: '#6366f1' }

    active.forEach(t => {
      const key = t.project_id && byProject[t.project_id] ? t.project_id : 'none'
      byProject[key].todos.push(t)
    })

    const groups = [byProject['none'], ...projects.map(p => byProject[p.id])]
    return { type: 'grouped', groups, done }
  }

  const viewData = getViewTodos()
  const allTags = [...new Set(todos.flatMap(t => t.tags || []))]

  if (!connected) return <SetupScreen onConnect={handleConnect} />

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-logo">upnext</div>
      <div className="loading-dots"><span /><span /><span /></div>
    </div>
  )

  const projectView = view.startsWith('project-') ? projects.find(p => view.includes(p.id)) : null
  const viewTitle = view === 'today' ? 'Today' : view === 'week' ? 'This Week' : view === 'month' ? 'This Month' : view === 'all' ? 'All Tasks' : projectView?.name || 'Tasks'

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">upnext</div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Views</div>
          <button className={`nav-item ${view === 'today' ? 'active' : ''}`} onClick={() => setView('today')}>
            <Sun size={15} /> Today
            <span className="nav-count">{todos.filter(t => !t.completed && t.due_date === format(new Date(), 'yyyy-MM-dd')).length || ''}</span>
          </button>
          <button className={`nav-item ${view === 'week' ? 'active' : ''}`} onClick={() => setView('week')}>
            <Calendar size={15} /> This Week
          </button>
          <button className={`nav-item ${view === 'month' ? 'active' : ''}`} onClick={() => setView('month')}>
            <LayoutList size={15} /> This Month
          </button>
          <button className={`nav-item ${view === 'all' ? 'active' : ''}`} onClick={() => setView('all')}>
            <CheckCircle2 size={15} /> All Tasks
          </button>
        </nav>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Projects</div>
          {projects.map(p => (
            <button
              key={p.id}
              className={`nav-item ${view === `project-${p.id}` ? 'active' : ''}`}
              onClick={() => setView(`project-${p.id}`)}
            >
              <span style={{ color: p.color }}>{p.icon}</span>
              {p.name}
              <span className="nav-count">{todos.filter(t => !t.completed && t.project_id === p.id).length || ''}</span>
            </button>
          ))}
        </nav>

        {allTags.length > 0 && (
          <nav className="sidebar-nav">
            <div className="nav-section-label">Tags</div>
            {allTags.map(tag => (
              <button
                key={tag}
                className={`nav-item tag-nav ${filter.tag === tag ? 'active' : ''}`}
                onClick={() => setFilter(f => ({ ...f, tag: f.tag === tag ? '' : tag }))}
              >
                <Tag size={12} /> #{tag}
              </button>
            ))}
          </nav>
        )}
      </aside>

      {/* Main */}
      <main className="main">
        <div className="main-header">
          <div className="main-header-left">
            <h1 className="view-title">{viewTitle}</h1>
            {view === 'today' && (
              <span className="view-date">{format(new Date(), 'EEEE, MMMM d')}</span>
            )}
          </div>
          <div className="main-header-right">
            {/* Filters */}
            <select className="filter-select" value={filter.priority} onChange={e => setFilter(f => ({ ...f, priority: e.target.value }))}>
              <option value="">All Priorities</option>
              <option value="high">🔴 High</option>
              <option value="medium">🟡 Medium</option>
              <option value="low">⚪ Low</option>
            </select>
            <select className="filter-select" value={filter.category} onChange={e => setFilter(f => ({ ...f, category: e.target.value }))}>
              <option value="">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button className="btn-primary" onClick={() => setModal('new')}>
              <Plus size={15} /> New Task
            </button>
          </div>
        </div>

        <QuickAdd onAdd={(title) => addTodo(title)} />

        <div className="main-content">
          {viewData.type === 'flat' ? (
            <>
              <TodoGroup
                title="Tasks" todos={viewData.active}
                projects={projects} categories={categories}
                onToggle={toggleTodo} onDelete={deleteTodo} onEdit={setModal}
                onDragEnd={handleDragEnd} accent="#6366f1"
              />
              {viewData.done?.length > 0 && (
                <TodoGroup
                  title="Completed" todos={viewData.done}
                  projects={projects} categories={categories}
                  onToggle={toggleTodo} onDelete={deleteTodo} onEdit={setModal}
                  onDragEnd={handleDragEnd} accent="#6b7280"
                />
              )}
            </>
          ) : (
            viewData.groups.map((g, i) => (
              <TodoGroup
                key={i} title={g.label} todos={g.todos}
                projects={projects} categories={categories}
                onToggle={toggleTodo} onDelete={deleteTodo} onEdit={setModal}
                onDragEnd={handleDragEnd} accent={g.accent}
              />
            ))
          )}

          {filteredTodos.filter(t => !t.completed).length === 0 && (
            <div className="empty-state">
              <CheckCircle2 size={40} />
              <p>All clear! Add a task to get started.</p>
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      {modal && (
        <TodoModal
          todo={modal === 'new' ? null : modal}
          projects={projects} categories={categories}
          onSave={saveTodo} onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
