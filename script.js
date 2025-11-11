let tipBlock
let lastBlocks

const cache = {}

const get = {
  byId: (id) => document.getElementById(id),
  cached: async (url, text = false) => {
    console.log('cached', url, Boolean(cache[url]))
    cache[url] = cache[url] || (await get.mempool(url, text))
    return cache[url]
  },
  json: async (url, text = false) => {
    try {
      const res = await fetch(url)
      return text ? res.text() : res.json()
    } catch {
      return null
    }
  },
  mempool: async (url, text = false) => {
    console.log('mempool', url)
    return await get.json(`https://mempool.space/api${url}`, text)
  },
  tip: async () => {
    const tip = await get.mempool('/blocks/tip/height')
    let hash = await get.cached(`/block-height/${tip}`, true)
    tipBlock = await get.cached(`/block/${hash}`)
  },
}

const pretty = {
  date: (timestamp, days = 2) => {
    const date = new Date(parseInt(timestamp))
    const show = date.toString().split(/\s\(/)[0]
    const diff = date - Date.now()
    const soon = days * 24 * 60 * 60 * 1000
    if (diff < soon) return show
    return show.split(/\s\d\d:/)[0]
  },
  movement: (avgTimeBlock) => {
    const percentageChange = parseFloat((600 - avgTimeBlock) / 6).toFixed(2) + '%'
    return `${avgTimeBlock < 600 ? '&uarr;' : '&darr;'} ${percentageChange}`
  },
  number: (num, maximumFractionDigits) => {
    if (num == undefined) return '?'
    const language = window.navigator.language
    return new Intl.NumberFormat(language, { maximumFractionDigits }).format(num)
  },
  smartDate: (timestamp, days = 1) => {
    const date = new Date(parseInt(timestamp))
    const show = date.toString().split(/\s\(/)[0]
    const diff = date - Date.now()
    const soon = days * 24 * 60 * 60 * 1000
    if (diff < soon) return `In ${pretty.timeago(Math.floor(diff / 1000))}`
    return show.split(/\s\d\d:/)[0]
  },
  timeago: (seconds, partial = []) => {
    const min = 60
    const hour = 60 * min
    const day = 24 * hour
    const week = 7 * day
    const year = 52 * week
    if (seconds > year) {
      const num = Math.floor(seconds / year)
      partial.push(`${num}y`)
      return pretty.timeago(seconds - num * year, partial)
    }
    if (seconds > week) {
      const num = Math.floor(seconds / week)
      partial.push(`${num}w`)
      return pretty.timeago(seconds - num * week, partial)
    }
    if (seconds > day) {
      const num = Math.floor(seconds / day)
      partial.push(`${num}d`)
      return pretty.timeago(seconds - num * day, partial)
    }
    if (seconds > hour) {
      const num = Math.floor(seconds / hour)
      partial.push(`${num}h`)
      return pretty.timeago(seconds - num * hour, partial)
    }
    if (seconds > min) {
      const num = Math.floor(seconds / min)
      partial.push(`${num}m`)
      return pretty.timeago(seconds - num * min, partial)
    }
    partial.push(`${seconds}s`)
    return partial.join(' ')
  },
}

const intervals = {
  uptime: () => {
    // Current time in seconds from the unix epoch start
    const timenow = Math.floor(new Date().getTime() / 1000)
    // Seconds since the bitcoin epoch.
    // Where 1230951265 is the number of seconds since the unix epoch start at
    // the time of the first block on Jan 3 2009 02:54:25 GMT
    const totaltime = timenow - 1230951265
    // Downtime for CVE-2010-5139: 8 hours, 27 minutes or 507 minutes = 30420 seconds.
    // See https://en.bitcoin.it/wiki/Value_overflow_incident
    // Discussion https://github.com/findbl0k/bitcoinUptime/issues/3
    const downtime2010 = 30420
    // Downtime for CVE-2013-3220: 6 hours, 55 minutes or 415 minutes = 24900 seconds.
    // See https://github.com/bitcoin/bips/blob/master/bip-0050.mediawiki
    const downtime2013 = 24900
    const downtimeTotal = downtime2010 + downtime2013
    const uptimePercent = (100 * (totaltime - downtimeTotal)) / totaltime
    const uptimeString = uptimePercent.toFixed(10).toString().concat(' %')
    get.byId('uptime-container').innerHTML = uptimeString
  },
}

const components = {
  bitcoinsMined: () => {
    let coins = 0
    let reward = 50
    for (let i = 0; i <= tipBlock.height; i++) {
      // Halve the reward every 210,000 blocks
      if (i % 210000 === 0 && i !== 0) reward /= 2
      coins += reward
    }
    get.byId('totalbc').innerText = pretty.number(coins)
  },
  blocksize: async () => {
    const { sizes } = await get.mempool('/v1/mining/blocks/sizes-weights/24h')
    const sum = sizes.reduce((prev, curr) => prev + curr.avgSize, 0)
    const avg = sum / sizes.length / 1024 / 1024 // convert to Mega Bytes
    get.byId('block_size').innerText = avg.toFixed(2) + ' MB'
  },
  difficulty: async () => {
    const arr = await get.mempool('/v1/mining/difficulty-adjustments/1m')
    get.byId('difficulty').innerHTML = arr[0][2].toExponential(3)
  },
  hashrate: async () => {
    const { currentHashrate } = await get.mempool('/v1/mining/hashrate/24h')
    get.byId('hash_rate').innerText = currentHashrate.toExponential(3)
  },
  latest: async () => {
    const halvingBlock = 1_050_000
    const unixNow = parseInt(Date.now() / 1000)
    const _60days = 60 * 24 * 60 * 60
    const { hash } = await get.cached(`/v1/mining/blocks/timestamp/${unixNow - _60days}`)
    const old = await get.cached(`/block/${hash}`)

    const avgTimeBlock = (tipBlock.timestamp - old.timestamp) / (tipBlock.height - old.height)
    const blocksToHalving = halvingBlock - tipBlock.height
    const halvingTimestamp = blocksToHalving * avgTimeBlock * 1000 + Date.now()

    lastBlocks = await get.cached(`/blocks/${tipBlock.height}`)
    lastBlocks = lastBlocks?.concat(await get.cached(`/blocks/${tipBlock.height - 15}`))
    timeline.draw(lastBlocks)

    get.byId('n_blocks_total').innerText = pretty.number(tipBlock.height)
    get.byId('halving-average-time').innerText = pretty.number(parseInt(avgTimeBlock))
    get.byId('halving-container').innerText = pretty.smartDate(halvingTimestamp)
    get.byId('halving-block').innerText = pretty.number(halvingBlock)
    get.byId('halving-blocks').innerText = pretty.number(blocksToHalving)
    get.byId('halving-date').innerHTML = pretty.date(halvingTimestamp)
    get.byId('last_block').setAttribute('href', `https://mempool.space`)
  },
  mempool: async () => {
    const json = await get.mempool('/mempool')
    get.byId('mempool').innerText = pretty.number(json.vsize) + ' vbytes'
  },
  price: async () => {
    const json = await get.json('https://btcoracle.bordalix.workers.dev')
    const rate = json.pricefeed ?? json
    const fees = await get.mempool('/v1/fees/recommended')
    fees.fiat = {
      fastestFee: pretty.number((fees.fastestFee * 140 * rate.usd) / 10e7, 2),
      minimumFee: pretty.number((fees.minimumFee * 140 * rate.usd) / 10e7, 2),
    }
    get.byId('market_price_usd').innerText = `$ ${pretty.number(rate.usd, 2)}`
    get.byId('market_price_eur').innerText = `€ ${pretty.number(rate.eur, 2)}`
    get.byId('fees-container').innerText =
      fees.fastestFee === fees.minimumFee
        ? `${fees.fastestFee} sats/vbyte`
        : `${fees.minimumFee} to ${fees.fastestFee} sats/vbyte`
    get.byId('fees-fiat').innerText =
      fees.fastestFee === fees.minimumFee
        ? `$${fees.fiat.fastestFee}`
        : `$${fees.fiat.minimumFee} to $${fees.fiat.fastestFee}`
    for (const id of Object.keys(fees)) {
      const el = get.byId(id)
      if (el && fees[id]) el.innerText = fees[id]
    }
  },
  retarget: async () => {
    const tipHeight = await get.mempool('/blocks/tip/height')
    const blocksSinceLastRetarget = tipHeight % 2016
    const blocksToNextRetarget = 2016 - blocksSinceLastRetarget
    const nextRetargetBlockHeight = tipHeight + blocksToNextRetarget
    const lastRetargetBlockHeight = tipHeight - blocksSinceLastRetarget

    const tipBlockHash = await get.cached(`/block-height/${tipHeight}`, true)
    const tipBlock = await get.cached(`/block/${tipBlockHash}`)
    const lastRetargetBlockHash = await get.cached(`/block-height/${lastRetargetBlockHeight}`, true)
    const lastRetargetBlock = await get.cached(`/block/${lastRetargetBlockHash}`)
    const averageSecondsPerBlock = (tipBlock.timestamp - lastRetargetBlock.timestamp) / blocksSinceLastRetarget
    const expectedTimeNextRetarget = Date.now() + blocksToNextRetarget * averageSecondsPerBlock * 1000

    get.byId('nextretarget-eta').innerText = pretty.smartDate(expectedTimeNextRetarget)
    get.byId('retarget-next-height').innerText = pretty.number(nextRetargetBlockHeight)
    get.byId('retarget-blocks').innerText = pretty.number(blocksToNextRetarget)
    get.byId('retarget-average-time').innerHTML = pretty.number(parseInt(averageSecondsPerBlock))
    get.byId('retarget-date').innerText = pretty.date(expectedTimeNextRetarget)
    get.byId('retarget-movement').innerHTML = pretty.movement(averageSecondsPerBlock)
    get.byId('difficulty-movement').innerHTML = pretty.movement(averageSecondsPerBlock)
  },
  transactions: async () => {
    const unixNow = parseInt(Date.now() / 1000)
    const aDayAgo = unixNow - 24 * 60 * 60
    const { height } = await get.cached(`/v1/mining/blocks/timestamp/${aDayAgo}`)
    const blocks = []
    let pointer = tipBlock.height
    while (pointer > height) {
      const arr = await get.cached(`/v1/blocks/${pointer}`)
      for (const info of arr) {
        if (!blocks.find((b) => b.height === info.height)) blocks.push(info)
      }
      pointer = arr[arr.length - 1].height - 1
    }
    const dailyTransactions = blocks.filter((b) => b.height >= height).reduce((prev, curr) => prev + curr.tx_count, 0)
    get.byId('transactions').innerText = pretty.number(dailyTransactions)
  },
  uptime: intervals.uptime,
}

const listeners = {
  modals: () => {
    // modal utils
    function openModal(id) {
      window.scrollTo(0, 0)
      history.pushState({}, '')
      get.byId(id).classList.add('is-active')
    }
    function closeModal(back = true) {
      for (const modal of document.getElementsByClassName('modal')) {
        modal.classList.remove('is-active')
      }
      if (back) history.back()
    }
    // close modal on back (mobile)
    window.addEventListener('popstate', () => closeModal(false))
    // hrefs were in place just for it to work without javascript
    // if javascript is enabled, show the modal instead
    const elementsToChangeLink = [
      'CVE-2010-5139',
      'CVE-2013-3220',
      'halving-show',
      'hashrate-show',
      'blocksize-show',
      'difficulty-show',
      'transactions-show',
      'mempool-show',
      'retarget-show',
      'downtime-show',
    ]
    for (const id of elementsToChangeLink) {
      const el = get.byId(id)
      el.removeAttribute('href')
      el.addEventListener('click', () => openModal(`${id}-modal`))
    }
    // add event listener to close modal buttons
    const els = document.getElementsByClassName('delete')
    for (const el of els) el.addEventListener('click', () => closeModal())
  },
}

const timeline = {
  prettyDate: (timestamp) => {
    const date = new Date(timestamp * 1000)
    const minutes = (date.getMinutes() < 10 ? '0' : '') + date.getMinutes()
    return `${date.getHours()}:${minutes}`
  },
  draw: (lastBlocks) => {
    const hourTicks = []
    const svg = { margin: 20, width: 1300, height: 320 }
    const numOfPeriods = 7
    const secondsPerPeriod = 600
    const graphWidth = svg.width - 2 * svg.margin
    const secondsToPixels = graphWidth / numOfPeriods / secondsPerPeriod
    const now = parseInt(new Date().getTime() / 1000)
    const lastTick = parseInt(now / secondsPerPeriod) * secondsPerPeriod
    const diffToNow = parseInt(now - lastTick)
    const getXbyTimestamp = (timestamp) => parseInt(svg.width - svg.margin - (now - timestamp) * secondsToPixels)

    lastBlocks.forEach((block) => {
      block.x = getXbyTimestamp(block.timestamp)
      block.y1 = svg.height - 2 * svg.margin
      block.y2 = 30
      block.label = `block ${block.height}`
    })

    for (let i = numOfPeriods; i >= 0; i--) {
      const timestamp = lastTick - i * secondsPerPeriod
      hourTicks.push({
        timestamp: timestamp,
        pretty_date: timeline.prettyDate(timestamp),
        x: getXbyTimestamp(timestamp),
        y1: svg.height - svg.margin,
        y2: svg.height - svg.margin * 2,
      })
    }
    const schema = 'http://www.w3.org/2000/svg'
    // return a svg line
    function getLine(x1, y1, x2, y2, color = '#000', width = 1) {
      const line = document.createElementNS(schema, 'line')
      line.setAttribute('x1', x1)
      line.setAttribute('y1', y1)
      line.setAttribute('x2', x2)
      line.setAttribute('y2', y2)
      line.setAttribute('style', `stroke:${color}; stroke-width:${width};`)
      return line
    }
    // return a svg text
    function getText(str, x, y, vertical = false, color = '#000') {
      const text = document.createElementNS(schema, 'text')
      text.setAttribute('style', `font-size: 14px; fill: ${color}`)
      text.textContent = str
      if (vertical) {
        text.setAttribute('transform', `translate(${x},${y}) rotate(-90)`)
      } else {
        text.setAttribute('x', x)
        text.setAttribute('y', y)
        text.setAttribute('text-anchor', 'middle')
      }
      return text
    }
    // return a svg a element
    function getAnchor(hash) {
      const a = document.createElementNS(schema, 'a')
      a.setAttribute('href', `https://mempool.space/block/${hash}`)
      return a
    }
    // return a rectangle centered on coordinates passed
    function getRect(x1) {
      const width = 40
      const height = 100
      const x = x1 - width / 2
      const y = 150
      const rect = document.createElementNS(schema, 'rect')
      rect.setAttribute('x', x)
      rect.setAttribute('y', y)
      rect.setAttribute('width', width)
      rect.setAttribute('height', height)
      rect.setAttribute('style', 'fill:#ddd;stroke-width:1;stroke:#000')
      return rect
    }
    // our svg
    const svg1 = get.byId('lastBlocksSVG')
    // remove all elements from svg
    while (svg1.lastChild) svg1.removeChild(svg1.lastChild)
    // make x axis
    const x_axis = {
      x1: svg.margin,
      y1: svg.height - 2 * svg.margin,
      x2: svg.margin + graphWidth,
      y2: svg.height - 2 * svg.margin,
    }
    svg1.appendChild(getLine(x_axis.x1, x_axis.y1, x_axis.x2, x_axis.y2))
    // put hour ticks on x axis
    hourTicks.forEach((tick) => {
      if (tick.x > 10) {
        svg1.appendChild(getLine(tick.x, tick.y1, tick.x, tick.y2)) // hour marks
        svg1.appendChild(getText(tick.pretty_date, tick.x, svg.height)) // hours
      }
    })
    // put blocks
    lastBlocks.forEach((block) => {
      svg1.appendChild(getText(block.label, block.x - 4, 120, true)) // block height
      svg1.appendChild(getLine(block.x, block.y1, block.x, block.y2, '#000')) // block vertical line
      const a = getAnchor(block.id)
      a.appendChild(getRect(block.x))
      a.appendChild(getText(block.tx_count + ' tx', block.x + 6, 230, true, '#3273dc'))
      svg1.appendChild(a)
    })
    // put 'now' line
    const nowLine = {
      x: svg.margin + graphWidth,
      y1: svg.height - 2 * svg.margin,
      y2: 35,
      label: `now ${timeline.prettyDate(now)}`,
      color: '#a00',
    }
    svg1.appendChild(getText(nowLine.label, nowLine.x + 13, nowLine.y2 + 65, true, nowLine.color))
    svg1.appendChild(getLine(nowLine.x, nowLine.y1, nowLine.x, nowLine.y2, nowLine.color))
  },
}

const theme = {
  set: () => {
    const previous = localStorage.getItem('theme')
    if (previous) {
      if (previous === 'dark') document.body.classList.add('dark')
      return
    }
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.body.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    }
  },
  toggle: () => {
    const toggleTheme = localStorage.getItem('theme') === 'dark' ? 'light' : 'dark'
    localStorage.setItem('theme', toggleTheme)
    document.body.classList.toggle('dark')
  },
}
