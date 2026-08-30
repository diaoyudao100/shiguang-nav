export interface SearchEngine {
  id: string
  name: string
  host: string // 用于展示 favicon
  url: string // %s 为关键词占位
}

export const SEARCH_ENGINES: SearchEngine[] = [
  { id: 'bing', name: '必应', host: 'www.bing.com', url: 'https://www.bing.com/search?q=%s' },
  { id: 'google', name: 'Google', host: 'www.google.com', url: 'https://www.google.com/search?q=%s' },
  { id: 'baidu', name: '百度', host: 'www.baidu.com', url: 'https://www.baidu.com/s?wd=%s' },
  { id: 'duckduckgo', name: 'DuckDuckGo', host: 'duckduckgo.com', url: 'https://duckduckgo.com/?q=%s' },
  { id: 'github', name: 'GitHub', host: 'github.com', url: 'https://github.com/search?q=%s' },
]

export function getEngine(id: string): SearchEngine {
  return SEARCH_ENGINES.find((e) => e.id === id) ?? SEARCH_ENGINES[0]
}
