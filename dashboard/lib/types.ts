export type Category = 'client' | 'vendor' | 'award' | 'newsletter' | 'internal' | 'unknown'
export type EntityType = 'client' | 'project' | 'thread' | 'mail' | 'task' | 'attachment' | 'link'

export interface Kpi {
  mails: number
  threads: number
  threads_open: number
  todos_open: number
  attachments: number
  links: number
  active_clients: number
  active_projects: number
  last_run: Run | null
}

export interface Run {
  id: number
  ran_at: string
  mails_added: number
  todos_added: number
  attachments_added: number
  links_added: number
}

export interface ClientSummary {
  domain: string
  name: string | null
  category: Category
  email_count: number
  thread_count: number
  open_threads: number
  last_seen: string | null
  project_count?: number
}

export interface Person {
  email: string
  name: string | null
  company_domain: string | null
  email_count: number
  last_seen: string | null
}

export interface Project {
  id: number
  client_domain: string
  name: string
  status: 'active' | 'paused' | 'done' | 'archived'
  notes: string | null
  created_at: string
  updated_at: string
  thread_count?: number
  todo_open_count?: number
  last_activity?: string | null
  client_name?: string | null
  client_category?: Category
}

export interface Thread {
  id: string
  subject_root: string
  company_domain: string | null
  status: string
  first_msg_date: string | null
  last_msg_date: string | null
  message_count: number
  project_id?: number | null
  category?: Category
  project_name?: string | null
}

export interface Mail {
  uid: number
  from_email: string
  from_name: string | null
  subject: string
  date: string
  mailbox: string | null
  thread_id: string | null
  is_spam: number
}

export interface Todo {
  id: number
  mail_uid: number
  text: string
  deadline: string | null
  done: number
  source: string
  owner: string
  client_domain: string | null
  mail_date: string | null
  mail_subject: string | null
  category: Category | null
  project_id?: number | null
  project_name?: string | null
}

export interface Attachment {
  id: number
  mail_uid: number
  filename: string
  mime: string
  size: number
  path: string | null
  mail_subject: string | null
  mail_date: string | null
  from_email: string | null
  client_domain: string | null
  category: Category | null
  thread_id?: string | null
  project_id?: number | null
}

export interface Link {
  id: number
  mail_uid: number
  url: string
  context: string | null
  mail_subject: string | null
  mail_date: string | null
  client_domain: string | null
  category: Category | null
}

export interface TopDomain {
  domain: string
  count: number
}

export interface ClientDetail extends ClientSummary {
  threads: Thread[]
  todos: Todo[]
  attachments: Attachment[]
  links: Link[]
  people: Person[]
  projects: Project[]
}

export interface ProjectDetail extends Project {
  client: ClientSummary | null
  threads: Thread[]
  todos: Todo[]
  attachments: Attachment[]
  links: Link[]
}

export interface ThreadDetail {
  thread: Thread
  mails: Mail[]
  todos: Todo[]
  attachments: Attachment[]
  links: Link[]
  client: ClientSummary | null
  project: Project | null
}

export interface AttachmentsByThread {
  thread_id: string
  subject_root: string
  company_domain: string | null
  category: Category
  project_id: number | null
  project_name: string | null
  last_msg_date: string | null
  attachments: Attachment[]
}

export interface SchedulerStatus {
  running: boolean
  pid: number | null
  last_run: Run | null
}

export interface ChatMessage {
  id: number
  chat_thread_id: number
  role: 'user' | 'napoleon' | 'system'
  content: string
  status: 'ok' | 'pending' | 'error'
  error: string | null
  created_at: string
}

export interface ChatThread {
  id: number
  entity_type: EntityType
  entity_id: string
  title: string | null
  created_at: string
  updated_at: string
  messages: ChatMessage[]
}
