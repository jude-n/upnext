import { useState, useEffect } from 'react'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from './supabase'
import {
  Plus, Grip, Tag, Calendar, ChevronDown, ChevronRight,
  X, Edit2, Trash2, Sun, LayoutList, Clock, Circle,
  CheckCircle2, LogOut, AlertTriangle, Pin, Settings,
  MessageSquare, ListChecks, Download, Upload, Send
} from 'lucide-react'
import { format, isToday, isTomorrow, isThisWeek, isThisMonth, parseISO, isPast, addDays } from 'date-fns'
import './App.css'

// ─── Constants & validation ───────────────────────────────────────────────────
const LIMITS = {
  title:       500,
  notes:       5000,
  tag:         50,
  tagCount:    20,
  projName:    100,
  projDesc:    500,
  catName:     50,
  comment:     2000,
  subtitle:    200,
}

const VALID_PRIORITIES = ['low', 'medium', 'high']
const HEX_RE  = /^#[0-9a-fA-F]{6}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const sanitizeText = (str) =>
  typeof str === 'string' ? str.replace(/<[^>]*>/g, '').trim() : ''

const sanitizeTags = (tags) =>
  (Array.isArray(tags) ? tags : [])
    .map(t => sanitizeText(t).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, LIMITS.tag))
    .filter(Boolean).slice(0, LIMITS.tagCount)

const safeUUID     = (val) => (UUID_RE.test(val) ? val : null)
const safeColor    = (val) => (HEX_RE.test(val)  ? val : '#6366f1')
const safePriority = (val) => (VALID_PRIORITIES.includes(val) ? val : 'medium')

const validateTodoForm = (form) => {
  const errors = []
  const title = sanitizeText(form.title)
  if (!title) errors.push('Title is required.')
  if (title.length > LIMITS.title) errors.push(`Title must be under ${LIMITS.title} characters.`)
  const notes = sanitizeText(form.notes)
  if (notes.length > LIMITS.notes) errors.push(`Notes must be under ${LIMITS.notes} characters.`)
  return { errors, title, notes }
}

const PRIORITY_CONFIG = {
  high:   { label: 'High',   color: '#ff4d4d', icon: '●' },
  medium: { label: 'Medium', color: '#f59e0b', icon: '●' },
  low:    { label: 'Low',    color: '#6b7280', icon: '●' },
}

const PRESET_COLORS = ['#6366f1','#f59e0b','#10b981','#ef4444','#3b82f6','#ec4899','#8b5cf6','#14b8a6']
const PRESET_ICONS  = ['📁','🚀','💼','🏠','❤️','📚','🎯','💡','🛠️','🌱']

const dueDateLabel = (dateStr) => {
  if (!dateStr) return null
  try {
    const d = parseISO(dateStr)
    if (isToday(d))    return { label: 'Today',            urgent: true }
    if (isTomorrow(d)) return { label: 'Tomorrow',         urgent: false }
    if (isPast(d))     return { label: format(d, 'MMM d'), urgent: true, overdue: true }
    if (isThisWeek(d)) return { label: format(d, 'EEE'),   urgent: false }
    return { label: format(d, 'MMM d'), urgent: false }
  } catch { return null }
}

// ─── Error Banner ─────────────────────────────────────────────────────────────
function ErrorBanner({ message, onDismiss }) {
  if (!message) return null
  return (
    <div className="error-banner">
      <AlertTriangle size={14} />
      <span>{message}</span>
      <button className="icon-btn" onClick={onDismiss}><X size={13} /></button>
    </div>
  )
}

// ─── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen() {
  const [email,   setEmail]   = useState('')
  const [code,    setCode]    = useState('')
  const [step,    setStep]    = useState('email')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const sendCode = async () => {
    const clean = email.trim().toLowerCase()
    if (!clean || !clean.includes('@') || !clean.includes('.')) {
      setError('Please enter a valid email address.'); return
    }
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.signInWithOtp({
      email: clean, options: { shouldCreateUser: true }
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setStep('code')
  }

  const verifyCode = async () => {
    const clean = code.trim()
    if (!clean) { setError('Please enter the code from your email.'); return }
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(), token: clean, type: 'email',
    })
    setLoading(false)
    if (err) { setError('Invalid or expired code. Try sending a new one.'); return }
  }

  if (step === 'code') return (
    <div className="setup-screen">
      <div className="setup-card">
        <div className="setup-logo">upnext</div>
        <p className="setup-sub">Check your email for your sign-in code.</p>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, marginBottom: 16 }}>
          Sent to <strong style={{ color: 'var(--text2)' }}>{email}</strong>
        </p>
        {error && <div className="form-error" style={{ marginBottom: 12 }}>{error}</div>}
        <div className="setup-fields">
          <input type="text" inputMode="text" placeholder="Paste code here"
            value={code} onChange={e => setCode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && verifyCode()}
            autoComplete="one-time-code" autoFocus
            style={{ fontSize: 16, textAlign: 'center', letterSpacing: 2 }} />
        </div>
        <button className="btn-primary full" onClick={verifyCode} disabled={loading || !code}>
          {loading ? 'Verifying…' : 'Verify Code →'}
        </button>
        <button className="btn-ghost" style={{ marginTop: 10, width: '100%' }}
          onClick={() => { setStep('email'); setCode(''); setError('') }}>
          ← Use a different email
        </button>
      </div>
    </div>
  )

  return (
    <div className="setup-screen">
      <div className="setup-card">
        <div className="setup-logo">upnext</div>
        <p className="setup-sub">Enter your email to get a sign-in code.</p>
        {error && <div className="form-error" style={{ marginBottom: 12 }}>{error}</div>}
        <div className="setup-fields">
          <input type="email" placeholder="your@email.com" value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendCode()}
            autoComplete="email" maxLength={254} />
        </div>
        <button className="btn-primary full" onClick={sendCode} disabled={loading || !email}>
          {loading ? 'Sending…' : 'Send Code →'}
        </button>
      </div>
    </div>
  )
}

// ─── Project Manager Modal ────────────────────────────────────────────────────
function ProjectManager({ projects, userId, onClose, onAdd, onDelete }) {
  const [name,  setName]  = useState('')
  const [desc,  setDesc]  = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [icon,  setIcon]  = useState(PRESET_ICONS[0])
  const [error, setError] = useState('')

  const handleAdd = async () => {
    const clean = sanitizeText(name)
    if (!clean) { setError('Name is required.'); return }
    if (clean.length > LIMITS.projName) { setError('Name too long.'); return }
    setError('')
    await onAdd({ name: clean, description: sanitizeText(desc) || null, color: safeColor(color), icon, user_id: userId })
    setName(''); setDesc('')
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span>Manage Projects</span>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          {error && <div className="form-error">{error}</div>}
          <div className="manager-list">
            {projects.length === 0 && <p style={{ color: 'var(--text3)', fontSize: 13 }}>No projects yet.</p>}
            {projects.map(p => (
              <div key={p.id} className="manager-row">
                <span style={{ color: p.color, fontSize: 16 }}>{p.icon}</span>
                <div className="manager-name-group">
                  <span className="manager-name">{p.name}</span>
                  {p.description && <span className="manager-desc">{p.description}</span>}
                </div>
                <button className="icon-btn danger" onClick={() => onDelete(p.id)}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
          <div className="manager-divider" />
          <div className="modal-field">
            <label>New Project Name</label>
            <input placeholder="e.g. Work, Personal…" value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              maxLength={LIMITS.projName} />
          </div>
          <div className="modal-field">
            <label>Description (optional)</label>
            <input placeholder="What's this project about?" value={desc}
              onChange={e => setDesc(e.target.value)}
              maxLength={LIMITS.projDesc} />
          </div>
          <div className="modal-field">
            <label>Icon</label>
            <div className="preset-grid">
              {PRESET_ICONS.map(ic => (
                <button key={ic} className={`preset-icon ${icon === ic ? 'selected' : ''}`}
                  onClick={() => setIcon(ic)}>{ic}</button>
              ))}
            </div>
          </div>
          <div className="modal-field">
            <label>Color</label>
            <div className="preset-grid">
              {PRESET_COLORS.map(c => (
                <button key={c} className={`preset-color ${color === c ? 'selected' : ''}`}
                  style={{ background: c }} onClick={() => setColor(c)} />
              ))}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Done</button>
          <button className="btn-primary" onClick={handleAdd}><Plus size={14} /> Add Project</button>
        </div>
      </div>
    </div>
  )
}

// ─── Category Manager Modal ───────────────────────────────────────────────────
function CategoryManager({ categories, userId, onClose, onAdd, onDelete }) {
  const [name,  setName]  = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [error, setError] = useState('')

  const handleAdd = async () => {
    const clean = sanitizeText(name)
    if (!clean) { setError('Name is required.'); return }
    if (clean.length > LIMITS.catName) { setError('Name too long.'); return }
    setError('')
    await onAdd({ name: clean, color: safeColor(color), user_id: userId })
    setName('')
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span>Manage Categories</span>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          {error && <div className="form-error">{error}</div>}
          <div className="manager-list">
            {categories.length === 0 && <p style={{ color: 'var(--text3)', fontSize: 13 }}>No categories yet.</p>}
            {categories.map(c => (
              <div key={c.id} className="manager-row">
                <span className="manager-color-dot" style={{ background: c.color }} />
                <span className="manager-name">{c.name}</span>
                <button className="icon-btn danger" onClick={() => onDelete(c.id)}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
          <div className="manager-divider" />
          <div className="modal-field">
            <label>New Category Name</label>
            <input placeholder="e.g. Work, Health…" value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              maxLength={LIMITS.catName} />
          </div>
          <div className="modal-field">
            <label>Color</label>
            <div className="preset-grid">
              {PRESET_COLORS.map(c => (
                <button key={c} className={`preset-color ${color === c ? 'selected' : ''}`}
                  style={{ background: c }} onClick={() => setColor(c)} />
              ))}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Done</button>
          <button className="btn-primary" onClick={handleAdd}><Plus size={14} /> Add Category</button>
        </div>
      </div>
    </div>
  )
}

// ─── Sortable Todo Item ────────────────────────────────────────────────────────
function SortableTodoItem({ todo, projects, categories, onToggle, onDelete, onEdit, onPin }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: todo.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  return (
    <div ref={setNodeRef} style={style}>
      <TodoItem todo={todo} projects={projects} categories={categories}
        onToggle={onToggle} onDelete={onDelete} onEdit={onEdit} onPin={onPin}
        dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  )
}

// ─── Todo Item ────────────────────────────────────────────────────────────────
function TodoItem({ todo, projects, categories, onToggle, onDelete, onEdit, onPin, dragHandleProps }) {
  const project  = projects.find(p => p.id === todo.project_id)
  const category = categories.find(c => c.id === todo.category_id)
  const dueInfo  = dueDateLabel(todo.due_date)
  const prio     = PRIORITY_CONFIG[todo.priority] || PRIORITY_CONFIG.medium

  return (
    <div className={`todo-item ${todo.completed ? 'completed' : ''} ${todo.pinned ? 'is-pinned' : ''} priority-${todo.priority}`}>
      <div className="todo-drag-handle" {...dragHandleProps}><Grip size={14} /></div>
      <button className="todo-check" onClick={() => onToggle(todo)}>
        {todo.completed ? <CheckCircle2 size={18} className="check-done" /> : <Circle size={18} className="check-empty" />}
      </button>
      <div className="todo-body" onClick={() => onEdit(todo)}>
        <div className="todo-title-row">
          <span className="todo-prio-dot" style={{ color: prio.color }}>{prio.icon}</span>
          <span className="todo-title">{todo.title}</span>
          {todo.pinned && <Pin size={10} className="pin-indicator" />}
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
        <button className={`icon-btn ${todo.pinned ? 'pin-active' : ''}`}
          title={todo.pinned ? 'Unpin from Today' : 'Pin to Today'} onClick={() => onPin(todo)}>
          <Pin size={12} />
        </button>
        <button className="icon-btn" onClick={() => onEdit(todo)}><Edit2 size={13} /></button>
        <button className="icon-btn danger" onClick={() => onDelete(todo.id)}><Trash2 size={13} /></button>
      </div>
    </div>
  )
}

// ─── Subtask Panel ────────────────────────────────────────────────────────────
function SubtaskPanel({ todoId, userId }) {
  const [subtasks, setSubtasks] = useState([])
  const [newTitle, setNewTitle] = useState('')
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (!todoId) return
    supabase.from('subtasks').select('*').eq('todo_id', todoId).order('sort_order')
      .then(({ data }) => { setSubtasks(data || []); setLoading(false) })
  }, [todoId])

  const addSubtask = async () => {
    const clean = sanitizeText(newTitle)
    if (!clean || clean.length > LIMITS.subtitle) return
    const { data } = await supabase.from('subtasks')
      .insert({ todo_id: todoId, user_id: userId, title: clean, sort_order: subtasks.length })
      .select().single()
    if (data) setSubtasks(s => [...s, data])
    setNewTitle('')
  }

  const toggleSubtask = async (sub) => {
    await supabase.from('subtasks').update({ completed: !sub.completed }).eq('id', sub.id)
    setSubtasks(s => s.map(x => x.id === sub.id ? { ...x, completed: !x.completed } : x))
  }

  const deleteSubtask = async (id) => {
    await supabase.from('subtasks').delete().eq('id', id)
    setSubtasks(s => s.filter(x => x.id !== id))
  }

  const done  = subtasks.filter(s => s.completed).length
  const total = subtasks.length
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="sub-panel">
      <div className="sub-panel-header">
        <ListChecks size={13} />
        <span>Subtasks</span>
        {total > 0 && <span className="sub-progress-label">{done}/{total}</span>}
      </div>

      {total > 0 && (
        <div className="sub-progress-bar">
          <div className="sub-progress-fill" style={{ width: `${pct}%` }} />
        </div>
      )}

      {loading ? <p style={{ color: 'var(--text3)', fontSize: 12 }}>Loading…</p> : (
        <div className="sub-list">
          {subtasks.map(sub => (
            <div key={sub.id} className={`sub-item ${sub.completed ? 'completed' : ''}`}>
              <button className="sub-check" onClick={() => toggleSubtask(sub)}>
                {sub.completed ? <CheckCircle2 size={15} className="check-done" /> : <Circle size={15} className="check-empty" />}
              </button>
              <span className="sub-title">{sub.title}</span>
              <button className="icon-btn danger" onClick={() => deleteSubtask(sub.id)}><X size={11} /></button>
            </div>
          ))}
        </div>
      )}

      <div className="sub-add">
        <input placeholder="Add subtask… (Enter)" value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addSubtask()}
          maxLength={LIMITS.subtitle} />
        {newTitle && <button className="icon-btn" onClick={addSubtask}><Plus size={13} /></button>}
      </div>
    </div>
  )
}

// ─── Comments Panel ───────────────────────────────────────────────────────────
function CommentsPanel({ todoId, userId }) {
  const [comments, setComments] = useState([])
  const [newText,  setNewText]  = useState('')
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (!todoId) return
    supabase.from('comments').select('*').eq('todo_id', todoId).order('created_at')
      .then(({ data }) => { setComments(data || []); setLoading(false) })
  }, [todoId])

  const addComment = async () => {
    const clean = sanitizeText(newText)
    if (!clean || clean.length > LIMITS.comment) return
    const { data } = await supabase.from('comments')
      .insert({ todo_id: todoId, user_id: userId, body: clean })
      .select().single()
    if (data) setComments(c => [...c, data])
    setNewText('')
  }

  const deleteComment = async (id) => {
    await supabase.from('comments').delete().eq('id', id)
    setComments(c => c.filter(x => x.id !== id))
  }

  return (
    <div className="sub-panel">
      <div className="sub-panel-header">
        <MessageSquare size={13} />
        <span>Updates & Comments</span>
        {comments.length > 0 && <span className="sub-progress-label">{comments.length}</span>}
      </div>

      {loading ? <p style={{ color: 'var(--text3)', fontSize: 12 }}>Loading…</p> : (
        <div className="comment-list">
          {comments.length === 0 && <p className="comment-empty">No updates yet. Add one below.</p>}
          {comments.map(c => (
            <div key={c.id} className="comment-item">
              <div className="comment-body">{c.body}</div>
              <div className="comment-footer">
                <span className="comment-time">{format(parseISO(c.created_at), 'MMM d, h:mm a')}</span>
                <button className="icon-btn danger" onClick={() => deleteComment(c.id)}><Trash2 size={11} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="comment-add">
        <textarea placeholder="Add an update or note…" value={newText}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), addComment())}
          maxLength={LIMITS.comment} rows={2} />
        <button className="btn-primary small" onClick={addComment} disabled={!newText.trim()}>
          <Send size={12} /> Post
        </button>
      </div>
    </div>
  )
}


function TodoModal({ todo, projects, categories, onSave, onClose, userId }) {
  const [tab,  setTab]  = useState('details')
  const [form, setForm] = useState({
    title:       todo?.title       || '',
    notes:       todo?.notes       || '',
    due_date:    todo?.due_date    || '',
    project_id:  todo?.project_id  || '',
    category_id: todo?.category_id || '',
    priority:    todo?.priority    || 'medium',
    tags:        (todo?.tags || []).join(', '),
    pinned:      todo?.pinned      || false,
  })
  const [errors, setErrors] = useState([])
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const isExisting = !!todo?.id

  const handleSave = () => {
    const { errors: errs, title, notes } = validateTodoForm(form)
    if (errs.length) { setErrors(errs); return }
    const rawTags = form.tags.split(',').map(t => t.trim()).filter(Boolean)
    onSave({
      title, notes: notes || null,
      due_date:    form.due_date    || null,
      project_id:  safeUUID(form.project_id)  || null,
      category_id: safeUUID(form.category_id) || null,
      priority:    safePriority(form.priority),
      tags:        sanitizeTags(rawTags),
      pinned:      form.pinned,
    })
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${isExisting ? 'modal-large' : ''}`}>
        <div className="modal-header">
          <span>{isExisting ? 'Edit Task' : 'New Task'}</span>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>

        {isExisting && (
          <div className="modal-tabs">
            {[
              { id: 'details',  label: 'Details' },
              { id: 'subtasks', label: 'Subtasks', icon: <ListChecks size={12} /> },
              { id: 'comments', label: 'Updates',  icon: <MessageSquare size={12} /> },
            ].map(t => (
              <button key={t.id} className={`modal-tab ${tab === t.id ? 'active' : ''}`}
                onClick={() => setTab(t.id)}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        )}

        {tab === 'details' && (
          <>
            <div className="modal-body">
              {errors.length > 0 && <div className="form-error">{errors.join(' ')}</div>}
              <input className="modal-title-input" placeholder="What needs to be done?"
                value={form.title} onChange={e => set('title', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                maxLength={LIMITS.title} autoFocus />
              <div className="char-count">{form.title.length}/{LIMITS.title}</div>
              <textarea className="modal-notes" placeholder="Notes (optional)"
                value={form.notes} onChange={e => set('notes', e.target.value)}
                maxLength={LIMITS.notes} rows={2} />
              <label className="pin-toggle">
                <input type="checkbox" checked={form.pinned} onChange={e => set('pinned', e.target.checked)} />
                <Pin size={13} />
                <span>Always show in Today</span>
              </label>
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
                <input placeholder="e.g. urgent, review, design" value={form.tags}
                  onChange={e => set('tags', e.target.value)}
                  maxLength={LIMITS.tag * LIMITS.tagCount} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn-primary" onClick={handleSave}>
                {isExisting ? 'Save Changes' : 'Add Task'}
              </button>
            </div>
          </>
        )}

        {tab === 'subtasks' && isExisting && (
          <div className="modal-body modal-body-tab">
            <SubtaskPanel todoId={todo.id} userId={userId} />
          </div>
        )}

        {tab === 'comments' && isExisting && (
          <div className="modal-body modal-body-tab">
            <CommentsPanel todoId={todo.id} userId={userId} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Group Section ────────────────────────────────────────────────────────────
function TodoGroup({ title, todos, projects, categories, onToggle, onDelete, onEdit, onPin, onDragEnd, accent }) {
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
      </div>
      {!collapsed && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={todos.map(t => t.id)} strategy={verticalListSortingStrategy}>
            <div className="todo-list">
              {todos.map(todo => (
                <SortableTodoItem key={todo.id} todo={todo}
                  projects={projects} categories={categories}
                  onToggle={onToggle} onDelete={onDelete} onEdit={onEdit} onPin={onPin} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}

// ─── Quick Add ────────────────────────────────────────────────────────────────
function QuickAdd({ onAdd }) {
  const [val, setVal] = useState('')
  const submit = () => {
    const clean = sanitizeText(val)
    if (!clean || clean.length > LIMITS.title) return
    onAdd(clean); setVal('')
  }
  return (
    <div className="quick-add">
      <Plus size={16} className="quick-add-icon" />
      <input placeholder="Add a task… (press Enter)" value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        maxLength={LIMITS.title} />
      {val && <button className="btn-primary small" onClick={submit}>Add</button>}
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [session,    setSession]    = useState(null)
  const [authReady,  setAuthReady]  = useState(false)
  const [todos,      setTodos]      = useState([])
  const [projects,   setProjects]   = useState([])
  const [categories, setCategories] = useState([])
  const [view,       setView]       = useState('today')
  const [modal,      setModal]      = useState(null)
  const [mgr,        setMgr]        = useState(null)  // 'projects' | 'categories' | null
  const [drawer,     setDrawer]     = useState(false) // mobile menu drawer
  const [filter,     setFilter]     = useState({ category: '', priority: '', tag: '' })
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')

  // ── Auth ──────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session); setAuthReady(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN')  { setSession(session); setAuthReady(true) }
      if (event === 'SIGNED_OUT') { setSession(null); setTodos([]); setProjects([]); setCategories([]) }
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── Load data ─────────────────────────────
  useEffect(() => {
    if (!session) return
    setLoading(true)
    Promise.all([
      supabase.from('todos').select('id,title,notes,completed,due_date,project_id,category_id,tags,priority,sort_order,pinned,created_at')
        .order('sort_order').order('created_at'),
      supabase.from('projects').select('id,name,color,icon').order('created_at'),
      supabase.from('categories').select('id,name,color').order('name'),
    ]).then(([t, p, c]) => {
      if (t.error) { setError('Failed to load tasks: ' + t.error.message) }
      else {
        setTodos(t.data || [])
        setProjects(p.data || [])
        setCategories(c.data || [])
      }
      setLoading(false)  // always runs now, never gets stuck
    })
  }, [session])

  // ── Realtime ──────────────────────────────
  // All todo state is managed locally via CRUD functions.
  // No realtime subscription for todos — avoids duplicate race conditions.
  // For a single-user app this is simpler and more reliable.
  // If you ever need multi-tab/device live sync, re-enable with dedup logic.

  const signOut = async () => { await supabase.auth.signOut(); setSession(null) }
  const userId  = session?.user?.id

  // ── Todo CRUD ─────────────────────────────
  const addTodo = async (titleOrObj) => {
    if (!userId) return
    const base = typeof titleOrObj === 'string'
      ? { title: titleOrObj, priority: 'medium', tags: [], pinned: false }
      : titleOrObj
    const newTodo = {
      ...base, user_id: userId, sort_order: todos.length,
      ...(view.startsWith('project-') ? { project_id: safeUUID(view.replace('project-', '')) } : {}),
      ...(view === 'today' ? { due_date: format(new Date(), 'yyyy-MM-dd') } : {}),
    }
    const { data, error: err } = await supabase.from('todos').insert(newTodo).select().single()
    if (err) { setError('Failed to add task.'); return }
    if (data) setTodos(t => [...t, data])
    return data
  }

  const updateTodo = async (updated) => {
    if (!userId) return
    const { user_id: _strip, ...safe } = updated
    const { data, error: err } = await supabase.from('todos').update(safe).eq('id', safe.id).select().single()
    if (err) { setError('Failed to update task.'); return }
    if (data) setTodos(t => t.map(x => x.id === data.id ? data : x))
    setModal(null)
  }

  const toggleTodo = async (todo) => {
    const { error: err } = await supabase.from('todos').update({ completed: !todo.completed }).eq('id', todo.id)
    if (err) { setError('Failed to update task.'); return }
    setTodos(t => t.map(x => x.id === todo.id ? { ...x, completed: !x.completed } : x))
  }

  const pinTodo = async (todo) => {
    const { error: err } = await supabase.from('todos').update({ pinned: !todo.pinned }).eq('id', todo.id)
    if (err) { setError('Failed to pin task.'); return }
    setTodos(t => t.map(x => x.id === todo.id ? { ...x, pinned: !x.pinned } : x))
  }

  const deleteTodo = async (id) => {
    if (!safeUUID(id)) return
    const { error: err } = await supabase.from('todos').delete().eq('id', id)
    if (err) { setError('Failed to delete task.'); return }
    setTodos(t => t.filter(x => x.id !== id))
  }

  const saveTodo = async (form) => {
    if (modal?.id) {
      updateTodo({ ...modal, ...form })
    } else {
      // After creating, re-open in edit mode so subtasks/comments are available
      const created = await addTodo(form)
      if (created) setModal(created)
    }
  }

  const handleDragEnd = async (group, reordered) => {
    setTodos(prev => {
      const ids = new Set(group.map(t => t.id))
      return [...prev.filter(t => !ids.has(t.id)), ...reordered]
    })
    await Promise.all(reordered.map((t, i) => supabase.from('todos').update({ sort_order: i }).eq('id', t.id)))
  }

  // ── Project / Category CRUD ───────────────
  const addProject = async (proj) => {
    const { data, error: err } = await supabase.from('projects').insert(proj).select().single()
    if (err) { setError('Failed to add project.'); return }
    if (data) setProjects(p => [...p, data])
  }

  const deleteProject = async (id) => {
    if (!safeUUID(id)) return
    const { error: err } = await supabase.from('projects').delete().eq('id', id)
    if (err) { setError('Failed to delete project.'); return }
    setProjects(p => p.filter(x => x.id !== id))
    if (view === `project-${id}`) setView('today')
  }

  const addCategory = async (cat) => {
    const { data, error: err } = await supabase.from('categories').insert(cat).select().single()
    if (err) { setError('Failed to add category.'); return }
    if (data) setCategories(c => [...c, data])
  }

  const deleteCategory = async (id) => {
    if (!safeUUID(id)) return
    const { error: err } = await supabase.from('categories').delete().eq('id', id)
    if (err) { setError('Failed to delete category.'); return }
    setCategories(c => c.filter(x => x.id !== id))
  }

  // ── Export CSV ────────────────────────────
  const exportCSV = () => {
    const headers = ['title','notes','priority','due_date','completed','pinned','tags','project','category']
    const rows = todos.map(t => {
      const proj = projects.find(p => p.id === t.project_id)
      const cat  = categories.find(c => c.id === t.category_id)
      return [
        `"${(t.title  || '').replace(/"/g,'""')}"`,
        `"${(t.notes  || '').replace(/"/g,'""')}"`,
        t.priority || 'medium',
        t.due_date || '',
        t.completed ? 'true' : 'false',
        t.pinned    ? 'true' : 'false',
        `"${(t.tags || []).join(';')}"`,
        `"${(proj?.name || '').replace(/"/g,'""')}"`,
        `"${(cat?.name  || '').replace(/"/g,'""')}"`,
      ].join(',')
    })
    const csv  = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `upnext-export-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Import CSV ────────────────────────────
  const importCSV = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    const text  = await file.text()
    const lines = text.split('\n').filter(Boolean)
    if (lines.length < 2) { setError('CSV appears empty.'); return }
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    const titleIdx = headers.indexOf('title')
    if (titleIdx === -1) { setError('CSV must have a "title" column.'); return }

    const parseField = (val) => val?.replace(/^"|"$/g, '').replace(/""/g, '"').trim() || ''

    const inserts = lines.slice(1).map(line => {
      // Simple CSV parse — handles quoted fields
      const fields = []
      let cur = '', inQuote = false
      for (const ch of line) {
        if (ch === '"') { inQuote = !inQuote }
        else if (ch === ',' && !inQuote) { fields.push(cur); cur = '' }
        else cur += ch
      }
      fields.push(cur)

      const get = (key) => parseField(fields[headers.indexOf(key)])
      const title = sanitizeText(get('title'))
      if (!title) return null

      return {
        user_id:   userId,
        title:     title.slice(0, LIMITS.title),
        notes:     sanitizeText(get('notes')).slice(0, LIMITS.notes) || null,
        priority:  safePriority(get('priority')),
        due_date:  get('due_date') || null,
        completed: get('completed') === 'true',
        pinned:    get('pinned')    === 'true',
        tags:      get('tags') ? get('tags').split(';').map(t => t.trim()).filter(Boolean) : [],
        sort_order: 0,
      }
    }).filter(Boolean)

    if (!inserts.length) { setError('No valid rows found in CSV.'); return }

    const { error: err } = await supabase.from('todos').insert(inserts)
    if (err) { setError('Import failed: ' + err.message); return }
    // Reload todos
    const { data } = await supabase.from('todos')
      .select('id,title,notes,completed,due_date,project_id,category_id,tags,priority,sort_order,pinned,created_at')
      .order('sort_order').order('created_at')
    if (data) setTodos(data)
    e.target.value = ''
  }

  // ── Filter & view logic ───────────────────
  const filteredTodos = todos.filter(t => {
    if (filter.category && t.category_id !== filter.category) return false
    if (filter.priority && t.priority !== filter.priority)     return false
    if (filter.tag && !(t.tags || []).includes(filter.tag))    return false
    return true
  })

  const getViewTodos = () => {
    const active = filteredTodos.filter(t => !t.completed)
    const done   = filteredTodos.filter(t => t.completed)

    if (view === 'today') {
      const today = format(new Date(), 'yyyy-MM-dd')
      return {
        type: 'flat',
        active: active.filter(t => t.due_date === today || t.pinned),
        done:   done.filter(t => t.due_date === today || t.pinned),
      }
    }
    if (view === 'week') {
      const groups = {}
      const order  = []
      for (let i = 0; i < 7; i++) {
        const d   = addDays(new Date(), i)
        const key = format(d, 'yyyy-MM-dd')
        groups[key] = { label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : format(d, 'EEEE, MMM d'), todos: [], accent: i === 0 ? '#ff6b35' : '#6366f1' }
        order.push(key)
      }
      groups['pinned']  = { label: 'Pinned',      todos: [], accent: '#818cf8' }
      groups['no-date'] = { label: 'No Due Date',  todos: [], accent: '#6b7280' }
      order.push('pinned', 'no-date')
      active.forEach(t => {
        if (t.pinned && !t.due_date) { groups['pinned'].todos.push(t); return }
        const k = t.due_date && groups[t.due_date] ? t.due_date : 'no-date'
        groups[k].todos.push(t)
      })
      return { type: 'grouped', groups: order.map(k => groups[k]) }
    }
    if (view === 'month') {
      return {
        type: 'grouped', groups: [
          { label: 'This Month',  todos: active.filter(t => t.due_date && isThisMonth(parseISO(t.due_date))), accent: '#6366f1' },
          { label: 'Pinned',      todos: active.filter(t => t.pinned && !t.due_date), accent: '#818cf8' },
          { label: 'No Due Date', todos: active.filter(t => !t.due_date && !t.pinned), accent: '#6b7280' },
        ]
      }
    }
    if (view.startsWith('project-')) {
      const pid = safeUUID(view.replace('project-', ''))
      return { type: 'flat', active: active.filter(t => t.project_id === pid), done: done.filter(t => t.project_id === pid) }
    }
    const byProject = {}
    projects.forEach(p => { byProject[p.id] = { label: `${p.icon} ${p.name}`, todos: [], accent: p.color } })
    byProject['none'] = { label: 'Inbox', todos: [], accent: '#6366f1' }
    active.forEach(t => { const k = t.project_id && byProject[t.project_id] ? t.project_id : 'none'; byProject[k].todos.push(t) })
    return { type: 'grouped', groups: [byProject['none'], ...projects.map(p => byProject[p.id])], done }
  }

  // ── Render guards ─────────────────────────
  if (!authReady) return (
    <div className="loading-screen">
      <div className="loading-logo">upnext</div>
      <div className="loading-dots"><span /><span /><span /></div>
    </div>
  )
  if (!session) return <LoginScreen />
  if (loading) return (
    <div className="loading-screen">
      <div className="loading-logo">upnext</div>
      <div className="loading-dots"><span /><span /><span /></div>
    </div>
  )

  const viewData    = getViewTodos()
  const allTags     = [...new Set(todos.flatMap(t => t.tags || []))]
  const projectView = view.startsWith('project-') ? projects.find(p => view.includes(p.id)) : null
  const viewTitle   = { today: 'Today', week: 'This Week', month: 'This Month', all: 'All Tasks' }[view] || projectView?.name || 'Tasks'
  const todayCount  = todos.filter(t => !t.completed && (t.due_date === format(new Date(), 'yyyy-MM-dd') || t.pinned)).length

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">upnext</div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Views</div>
          {[
            { id: 'today', icon: <Sun size={15} />,          label: 'Today',     count: todayCount },
            { id: 'week',  icon: <Calendar size={15} />,     label: 'This Week' },
            { id: 'month', icon: <LayoutList size={15} />,   label: 'This Month' },
            { id: 'all',   icon: <CheckCircle2 size={15} />, label: 'All Tasks', count: todos.filter(t => !t.completed).length },
          ].map(v => (
            <button key={v.id} className={`nav-item ${view === v.id ? 'active' : ''}`} onClick={() => setView(v.id)}>
              {v.icon} {v.label}
              {v.count > 0 && <span className="nav-count">{v.count}</span>}
            </button>
          ))}
        </nav>

        <nav className="sidebar-nav">
          <div className="nav-section-label nav-section-with-action">
            <span>Projects</span>
            <button className="nav-action-btn" onClick={() => setMgr('projects')}><Settings size={11} /></button>
          </div>
          {projects.length === 0 && (
            <button className="nav-item nav-empty" onClick={() => setMgr('projects')}>
              <Plus size={12} /> Add a project
            </button>
          )}
          {projects.map(p => (
            <button key={p.id} className={`nav-item ${view === `project-${p.id}` ? 'active' : ''}`}
              onClick={() => setView(`project-${p.id}`)}>
              <span style={{ color: p.color }}>{p.icon}</span> {p.name}
              <span className="nav-count">{todos.filter(t => !t.completed && t.project_id === p.id).length || ''}</span>
            </button>
          ))}
        </nav>

        <nav className="sidebar-nav">
          <div className="nav-section-label nav-section-with-action">
            <span>Categories</span>
            <button className="nav-action-btn" onClick={() => setMgr('categories')}><Settings size={11} /></button>
          </div>
          {categories.length === 0 && (
            <button className="nav-item nav-empty" onClick={() => setMgr('categories')}>
              <Plus size={12} /> Add a category
            </button>
          )}
          {categories.map(c => (
            <button key={c.id} className={`nav-item ${filter.category === c.id ? 'active' : ''}`}
              onClick={() => setFilter(f => ({ ...f, category: f.category === c.id ? '' : c.id }))}>
              <span className="cat-dot" style={{ background: c.color }} /> {c.name}
            </button>
          ))}
        </nav>

        {allTags.length > 0 && (
          <nav className="sidebar-nav">
            <div className="nav-section-label">Tags</div>
            {allTags.map(tag => (
              <button key={tag} className={`nav-item tag-nav ${filter.tag === tag ? 'active' : ''}`}
                onClick={() => setFilter(f => ({ ...f, tag: f.tag === tag ? '' : tag }))}>
                <Tag size={12} /> #{tag}
              </button>
            ))}
          </nav>
        )}

        <div className="sidebar-footer">
          <button className="nav-item" onClick={signOut} style={{ color: 'var(--text3)' }}>
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </aside>

      <main className="main">
        <ErrorBanner message={error} onDismiss={() => setError('')} />
        <div className="main-header">
          <div className="main-header-left">
            <h1 className="view-title">{viewTitle}</h1>
            {view === 'today' && <span className="view-date">{format(new Date(), 'EEEE, MMMM d')}</span>}
          </div>
          <div className="main-header-right">
            <select className="filter-select" value={filter.priority}
              onChange={e => setFilter(f => ({ ...f, priority: e.target.value }))}>
              <option value="">All Priorities</option>
              <option value="high">🔴 High</option>
              <option value="medium">🟡 Medium</option>
              <option value="low">⚪ Low</option>
            </select>
            <button className="btn-ghost icon-only" title="Export CSV" onClick={exportCSV}>
              <Download size={14} />
            </button>
            <label className="btn-ghost icon-only" title="Import CSV">
              <Upload size={14} />
              <input type="file" accept=".csv" onChange={importCSV} style={{ display: 'none' }} />
            </label>
            <button className="btn-primary" onClick={() => setModal('new')}>
              <Plus size={15} /> New Task
            </button>
          </div>
        </div>

        <QuickAdd onAdd={addTodo} />

        <div className="main-content">
          {viewData.type === 'flat' ? (
            <>
              <TodoGroup title="Tasks" todos={viewData.active} projects={projects} categories={categories}
                onToggle={toggleTodo} onDelete={deleteTodo} onEdit={setModal} onPin={pinTodo}
                onDragEnd={handleDragEnd} accent="#6366f1" />
              {(viewData.done?.length > 0) && (
                <TodoGroup title="Completed" todos={viewData.done} projects={projects} categories={categories}
                  onToggle={toggleTodo} onDelete={deleteTodo} onEdit={setModal} onPin={pinTodo}
                  onDragEnd={handleDragEnd} accent="#6b7280" />
              )}
            </>
          ) : (
            viewData.groups.map((g, i) => (
              <TodoGroup key={i} title={g.label} todos={g.todos} projects={projects} categories={categories}
                onToggle={toggleTodo} onDelete={deleteTodo} onEdit={setModal} onPin={pinTodo}
                onDragEnd={handleDragEnd} accent={g.accent} />
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

      {modal && (
        <TodoModal todo={modal === 'new' ? null : modal}
          projects={projects} categories={categories} userId={userId}
          onSave={saveTodo} onClose={() => setModal(null)} />
      )}
      {mgr === 'projects' && (
        <ProjectManager projects={projects} userId={userId}
          onClose={() => setMgr(null)} onAdd={addProject} onDelete={deleteProject} />
      )}
      {mgr === 'categories' && (
        <CategoryManager categories={categories} userId={userId}
          onClose={() => setMgr(null)} onAdd={addCategory} onDelete={deleteCategory} />
      )}

      {/* ── Mobile Tab Bar ── */}
      <nav className="mobile-tab-bar">
        {[
          { id: 'today', icon: <Sun size={20} />,          label: 'Today',   count: todayCount },
          { id: 'week',  icon: <Calendar size={20} />,     label: 'Week' },
          { id: 'all',   icon: <CheckCircle2 size={20} />, label: 'All',     count: todos.filter(t => !t.completed).length },
        ].map(v => (
          <button key={v.id} className={`tab-btn ${view === v.id ? 'active' : ''}`}
            onClick={() => { setView(v.id); setDrawer(false) }}>
            {v.count > 0 && <span className="tab-badge">{v.count}</span>}
            {v.icon}
            {v.label}
          </button>
        ))}
        <button className={`tab-btn ${drawer ? 'active' : ''}`} onClick={() => setDrawer(d => !d)}>
          <Settings size={20} />
          More
        </button>
      </nav>

      {/* ── Mobile Drawer ── */}
      {drawer && (
        <>
          <div className="drawer-overlay" onClick={() => setDrawer(false)} />
          <div className="drawer">
            <div className="drawer-handle" />

            <div className="drawer-section">
              <div className="drawer-section-label">
                <span>Projects</span>
                <button className="nav-action-btn" onClick={() => { setMgr('projects'); setDrawer(false) }}>
                  <Settings size={11} />
                </button>
              </div>
              {projects.length === 0 && (
                <button className="drawer-item" onClick={() => { setMgr('projects'); setDrawer(false) }}>
                  <Plus size={14} /> Add a project
                </button>
              )}
              {projects.map(p => (
                <button key={p.id}
                  className={`drawer-item ${view === `project-${p.id}` ? 'active' : ''}`}
                  onClick={() => { setView(`project-${p.id}`); setDrawer(false) }}>
                  <span style={{ color: p.color }}>{p.icon}</span> {p.name}
                  <span className="drawer-item-count">{todos.filter(t => !t.completed && t.project_id === p.id).length || ''}</span>
                </button>
              ))}
            </div>

            <div className="drawer-section">
              <div className="drawer-section-label">
                <span>Categories</span>
                <button className="nav-action-btn" onClick={() => { setMgr('categories'); setDrawer(false) }}>
                  <Settings size={11} />
                </button>
              </div>
              {categories.length === 0 && (
                <button className="drawer-item" onClick={() => { setMgr('categories'); setDrawer(false) }}>
                  <Plus size={14} /> Add a category
                </button>
              )}
              {categories.map(c => (
                <button key={c.id}
                  className={`drawer-item ${filter.category === c.id ? 'active' : ''}`}
                  onClick={() => { setFilter(f => ({ ...f, category: f.category === c.id ? '' : c.id })); setDrawer(false) }}>
                  <span className="cat-dot" style={{ background: c.color }} /> {c.name}
                </button>
              ))}
            </div>

            {allTags.length > 0 && (
              <div className="drawer-section">
                <div className="drawer-section-label">Tags</div>
                {allTags.map(tag => (
                  <button key={tag}
                    className={`drawer-item ${filter.tag === tag ? 'active' : ''}`}
                    onClick={() => { setFilter(f => ({ ...f, tag: f.tag === tag ? '' : tag })); setDrawer(false) }}>
                    <Tag size={13} /> #{tag}
                  </button>
                ))}
              </div>
            )}

            <button className="drawer-sign-out" onClick={signOut}>
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </>
      )}
    </div>
  )
}
