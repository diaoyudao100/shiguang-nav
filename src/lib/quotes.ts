export const QUOTES: { text: string; from: string }[] = [
  { text: '凡是过往，皆为序章。', from: '莎士比亚' },
  { text: '智慧只能使人免于无知，不能使人免于痛苦。', from: '洞穴的囚徒' },
  { text: 'I dwell in possibility. 我栖居于无限的可能之中。', from: '艾米莉·狄金森' },
  { text: '种一棵树最好的时间是十年前，其次是现在。', from: '谚语' },
  { text: '简单比复杂更难，但值得为之努力。', from: '史蒂夫·乔布斯' },
  { text: '我们塑造工具，然后工具塑造我们。', from: '麦克卢汉' },
  { text: '千里之行，始于足下。', from: '老子' },
  { text: '纸上得来终觉浅，绝知此事要躬行。', from: '陆游' },
  { text: 'The best way out is always through. 最好的出路永远是穿过去。', from: '罗伯特·弗罗斯特' },
  { text: '不要温和地走进那个良夜。', from: '狄兰·托马斯' },
  { text: '心之所向，素履以往。', from: '七堇年' },
  { text: 'Less, but better. 更少，但更好。', from: '迪特·拉姆斯' },
  { text: 'Talk is cheap. Show me the code. ', from: '林纳斯·托瓦兹' },
  { text: '山不过来，我就过去。', from: '谚语' },
  { text: '你若盛开，清风自来。', from: '谚语' },
  { text: 'Stay hungry, stay foolish. 求知若饥，虚心若愚。', from: '斯图尔特·布兰德' },
  { text: '博观而约取，厚积而薄发。', from: '苏轼' },
  { text: 'Per aspera ad astra. 循此苦旅，以达星辰。', from: '塞内卡' },
  { text: '不积跬步，无以至千里。', from: '荀子' },
  { text: '行动是治愈恐惧的良药。', from: '诺曼·文森特·皮尔' },
]

/** 按日期取一句话：同一天内稳定，隔天更换 */
export function quoteOfTheDay(): { text: string; from: string } {
  const now = new Date()
  const day = Math.floor(now.getTime() / 86400000)
  return QUOTES[day % QUOTES.length]
}
