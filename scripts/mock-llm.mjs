/** 本地 mock LLM：验证 worker /api/ai/chat 的"模型不匹配→自动拉列表→换模型重试"链路
 *  用法：node scripts/mock-llm.mjs  → 监听 127.0.0.1:9377
 */
import http from 'node:http'

const PORT = 9377

http
  .createServer((req, res) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString()
      if (req.url === '/v1/models') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            data: [
              { id: 'deepseek-v4-pro' },
              { id: 'deepseek-v4-flash' },
              { id: 'deepseek-v4-flash-vision-exp' },
              { id: 'text-embedding-v4' },
            ],
          }),
        )
        return
      }
      if (req.url === '/v1/chat/completions') {
        const model = (() => {
          try {
            return JSON.parse(body).model
          } catch {
            return ''
          }
        })()
        if (model === 'gpt-4o-mini') {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(
            JSON.stringify({
              error: {
                message:
                  'The supported API model names are deepseek-v4-pro, deepseek-v4-flash, and deepseek-v4-flash-vision-exp, but you passed gpt-4o-mini.',
              },
            }),
          )
          return
        }
        // quick-add 的提示词要求 JSON（简介 + 自动归类）；body 是 JSON 转义过的，引号带反斜杠
        const wantJson = /category/.test(body)
        const text = wantJson
          ? '{"desc":"mock 简介","category":"开发工具"}'
          : `mock-ok via ${model}`
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ choices: [{ message: { content: text } }]}))
        return
      }
      res.writeHead(404)
      res.end('{}')
    })
  })
  .listen(PORT, '127.0.0.1', () => console.log(`mock llm on http://127.0.0.1:${PORT}`))
