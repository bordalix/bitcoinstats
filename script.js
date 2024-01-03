const mainApiUrl = 'https://mempool.space/api'
// app state
const blocks = {
  avg_time_block: {
    sixty_days: null,
    last_retarget: null,
  },
  distance: {
    sixty_days: 6 * 24 * 60,
    last_retarget: null,
  },
  halving: {
    height: 840000,
    timestamp: null,
  },
  last_retarget: {
    height: null,
    timestamp: null,
  },
  latest: {
    hash: null,
    height: null,
    timestamp: null,
  },
  queries: 10,
  retarget: {
    height: null,
    timestamp: null,
  },
  sixty_days: {
    height: null,
    timestamp: null,
  },
  stats: {
    mempoolsize: null,
    avgblocksize: 0,
    market_price_usd: null,
    market_price_eur: null,
    difficulty: null,
    hash_rate: null,
    totalbc: null,
    n_tx: null,
  },
  time_to: {
    halving: null,
    retarget: null,
  },
  until: {
    halving: null,
    retarget: null,
  },
  fees: {
    fastestFee: 1,
    halfHourFee: 1,
    hourFee: 1,
    economyFee: 1,
    minimumFee: 1,
  },
}
// keep lines short
const geById = (id) => document.getElementById(id)
//
function manageWait() {
  blocks.queries -= 1
  const progress = document.getElementsByTagName('progress')[0]
  if (blocks.queries == 0) progress.style.visibility = 'hidden'
  if (blocks.queries >= 0)
    progress.setAttribute('value', (10 - blocks.queries) * 10)
}
//
function initDOM() {
  // modal utils
  function openModal(id) {
    window.scrollTo(0, 0)
    history.pushState({}, '')
    geById(id).classList.add('is-active')
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
    'fees-show',
  ]
  for (const id of elementsToChangeLink) {
    const el = geById(id)
    el.removeAttribute('href')
    el.addEventListener('click', () => openModal(`${id}-modal`))
  }
  // add event listener to close modal buttons
  const els = document.getElementsByClassName('delete')
  for (const el of els) el.addEventListener('click', () => closeModal())
}
//
function startTimers() {
  // format time since last block
  function displayTimeAgo() {
    const now = new Date().getTime() / 1000
    let seconds = parseInt(now - blocks.latest.timestamp)
    const minutes = Math.floor(seconds / 60)
    seconds -= minutes * 60
    const time_ago = minutes + 'm ' + seconds + 's'
    geById('latest-time-ago').innerHTML = time_ago
    return true
  }
  // display network uptime
  function displayUptime() {
    // Current time in seconds from the unix epoch start
    var timenow = Math.floor(new Date().getTime() / 1000)
    // Seconds since the bitcoin epoch.
    // Where 1230951265 is the number of seconds since the unix epoch start at
    // the time of the first block on Jan 3 2009 02:54:25 GMT
    var totaltime = timenow - 1230951265
    // Downtime for CVE-2010-5139: 8 hours, 27 minutes or 507 minutes = 30420 seconds.
    // See https://en.bitcoin.it/wiki/Value_overflow_incident
    // Discussion https://github.com/findbl0k/bitcoinUptime/issues/3
    var downtime2010 = 30420
    // Downtime for CVE-2013-3220: 6 hours, 55 minutes or 415 minutes = 24900 seconds.
    // See https://github.com/bitcoin/bips/blob/master/bip-0050.mediawiki
    var downtime2013 = 24900
    var downtimeTotal = downtime2010 + downtime2013
    var uptimePercent = (100 * (totaltime - downtimeTotal)) / totaltime
    var uptimeString = uptimePercent.toFixed(10).toString().concat(' %')
    geById('uptime-container').innerHTML = uptimeString
    return true
  }
  // set timers
  if (displayTimeAgo()) setInterval(displayTimeAgo, 1000)
  if (displayUptime()) setInterval(displayUptime, 1000)
  setTimeout(function () {
    getFullData()
    setInterval(getFullData, 60000)
  }, (60 - new Date().getSeconds()) * 1000)
}
//
function getFullData() {
  // return API URL for given block
  function apiURL(block) {
    manageWait()
    url = mainApiUrl
    if (block === 'fees') return `${url}/v1/fees/recommended`
    if (block === 'latest') return `${url}/blocks/tip/height`
    if (block === 'sixty_days')
      return `${url}/block-height/${parseInt(
        blocks.latest.height - blocks.distance.sixty_days
      )}`
    if (block === 'last_retarget')
      return `${url}/block-height/${parseInt(blocks.retarget.height - 2016)}`
    if (block === 'stats') return 'https://api.blockchain.info/stats'
    if (block === 'blocksize')
      return 'https://api.blockchain.info/q/24hravgblocksize'
    if (block === 'mempool')
      return 'https://api.blockchain.info/charts/mempool-size?timespan=1days&format=json&cors=true'
    if (block === 'price') return 'https://btcoracle.bordalix.workers.dev'
    if (block.length > 10) return `${url}/block/${block}`
    return `${url}/block-height/${block}`
  }
  // fetch from API
  async function myFetch(url) {
    try {
      return (await fetch(url)).json()
    } catch {
      return null
    }
  }
  // render DOM
  function renderDOM() {
    function populateHTML() {
      // format date, show hour if less than one week
      function shortDate(timestamp) {
        const date = new Date(timestamp * 1000)
        const show = date.toString().split(/\s\(/)[0]
        const diff = date - Date.now()
        const soon = 3 * 24 * 60 * 60 * 1000
        if (diff < soon) return show
        return show.split(/\s\d\d:/)[0]
      }
      // put commas and points on numbers
      function prettyNumber(number) {
        if (number == undefined) return '?'
        const language = window.navigator.language
        return new Intl.NumberFormat(language, {}).format(number)
      }
      // show difficulty movement
      function showDifficultyMovement(textual = false) {
        const percentageChange =
          parseFloat((600 - blocks.avg_time_block.last_retarget) / 6).toFixed(
            2
          ) + '%'
        if (blocks.avg_time_block.last_retarget < 600)
          return (textual ? 'Will increase ' : '&uarr; ') + percentageChange
        if (blocks.avg_time_block.last_retarget > 600)
          return (textual ? 'Will decrease ' : '&darr; ') + percentageChange
        return (textual ? 'Will maintain' : '') + ' = '
      }
      // render data on halving
      geById('halving-container').innerHTML = shortDate(
        blocks.halving.timestamp
      )
      geById('latest-height').innerHTML = prettyNumber(blocks.latest.height)
      geById('latest-timestamp').innerHTML = prettyNumber(
        blocks.latest.timestamp
      )
      geById('distance-blocks').innerHTML =
        prettyNumber(blocks.distance.sixty_days) + ' blocks (~2 months)'
      geById('from-height').innerHTML =
        prettyNumber(blocks.sixty_days.height) + ' <sup>a-c</sup>'
      geById('from-timestamp').innerHTML = prettyNumber(
        blocks.sixty_days.timestamp
      )
      geById('average-time').innerHTML =
        prettyNumber(parseInt(blocks.avg_time_block.sixty_days)) +
        ' seconds <sup>(b-d)/c</sup>'
      geById('halving-blocks').innerHTML =
        prettyNumber(blocks.until.halving) +
        ` blocks <sup>${blocks.halving.height}-a</sup>`
      geById('halving-timestamp').innerHTML =
        prettyNumber(parseInt(blocks.halving.timestamp)) + ' <sup>b+e*f</sup>'
      geById('halving-date').innerHTML = shortDate(blocks.halving.timestamp)
      geById('n_blocks_total').innerHTML = prettyNumber(blocks.latest.height)
      geById('last_block').setAttribute(
        'href',
        `https://mempool.space/block/${blocks.latest.hash}`
      )
      // render data on retarget modal
      geById('retarget-latest-height').innerHTML = prettyNumber(
        blocks.latest.height
      )
      geById('retarget-latest-timestamp').innerHTML = prettyNumber(
        blocks.latest.timestamp
      )
      geById('retarget-blocks').innerHTML =
        prettyNumber(blocks.until.retarget, 'blocks') + ` <sup>a-b</sup>`
      geById('retarget-movement').innerHTML = showDifficultyMovement(true)
      geById('nextretarget').innerHTML = prettyNumber(blocks.retarget.height)
      geById('nextretarget-eta').innerHTML = shortDate(
        blocks.retarget.timestamp
      )
      geById('retarget-next-height').innerHTML = prettyNumber(
        blocks.retarget.height
      )
      geById('last-retarget-height').innerHTML =
        prettyNumber(blocks.last_retarget.height) + ' <sup>a-2016</sup>'
      geById('retarget-distance-blocks').innerHTML =
        prettyNumber(blocks.distance.last_retarget) + ' <sup>b-d</sup>'
      geById('last-retarget-timestamp').innerHTML = prettyNumber(
        blocks.last_retarget.timestamp
      )
      geById('retarget-average-time').innerHTML =
        prettyNumber(parseInt(blocks.avg_time_block.last_retarget)) +
        ' seconds <sup>(c-e)/f</sup>'
      geById('retarget-timestamp').innerHTML =
        prettyNumber(parseInt(blocks.retarget.timestamp)) + ' <sup>c+g*h</sup>'
      geById('retarget-date').innerHTML = shortDate(blocks.retarget.timestamp)
      // render stats
      geById('market_price_usd').innerHTML =
        '$ ' + prettyNumber(blocks.stats.market_price_usd)
      geById('market_price_eur').innerHTML =
        '€ ' + prettyNumber(blocks.stats.market_price_eur)
      geById('allbcever').innerHTML = prettyNumber(20999817.3)
      geById('totalbc').innerHTML = prettyNumber(
        blocks.stats.totalbc / 100000000
      )
      geById('hash_rate').innerHTML = blocks.stats.hash_rate.toExponential(3)
      geById('difficulty').innerHTML = blocks.stats.difficulty.toExponential(3)
      geById('difficulty-movement').innerHTML = showDifficultyMovement(true)
      geById('transactions').innerHTML = prettyNumber(blocks.stats.n_tx)
      geById('block_size').innerHTML =
        blocks.stats.avgblocksize?.toFixed(2) + ' MB'
      geById('mempool').innerHTML =
        prettyNumber(blocks.stats.mempoolsize?.y) + ' bytes'
      //
      geById('fees-container').innerHTML =
        fees.fastestFee === fees.minimumFee
          ? `${fees.fastestFee} sats/vbyte`
          : `${fees.minimumFee} to ${fees.fastestFee} sats/vbyte`
      for (const id of Object.keys(fees)) {
        geById(id).innerHTML = fees[id]
      }
      // show more link
      geById('halving').style.visibility = 'visible'
    }
    function displayLastBlocks() {
      //
      let lastBlocks
      const hourTicks = []
      const svg = { margin: 20, width: 1300, height: 320 }
      const numOfPeriods = 7
      const secondsPerPeriod = 600
      const graphWidth = svg.width - 2 * svg.margin
      const secondsToPixels = graphWidth / numOfPeriods / secondsPerPeriod
      const now = parseInt(new Date().getTime() / 1000)
      const lastTick = parseInt(now / secondsPerPeriod) * secondsPerPeriod
      const diffToNow = parseInt(now - lastTick)
      //
      function prettyDate(timestamp) {
        const date = new Date(timestamp * 1000)
        const minutes = (date.getMinutes() < 10 ? '0' : '') + date.getMinutes()
        return `${date.getHours()}:${minutes}`
      }
      //
      function getXbyTimestamp(timestamp) {
        return parseInt(
          svg.width - svg.margin - (now - timestamp) * secondsToPixels
        )
      }
      //
      function calcTime() {
        for (let i = numOfPeriods; i >= 0; i--) {
          const timestamp = lastTick - i * secondsPerPeriod
          hourTicks.push({
            timestamp: timestamp,
            pretty_date: prettyDate(timestamp),
            x: getXbyTimestamp(timestamp),
            y1: svg.height - svg.margin,
            y2: svg.height - svg.margin * 2,
          })
        }
      }
      //
      function drawSVG() {
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
        const svg1 = geById('lastBlocksSVG')
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
          svg1.appendChild(
            getLine(block.x, block.y1, block.x, block.y2, '#000')
          ) // block vertical line
          const a = getAnchor(block.id)
          a.appendChild(getRect(block.x))
          a.appendChild(
            getText(block.tx_count + ' tx', block.x + 6, 230, true, '#3273dc')
          )
          svg1.appendChild(a)
        })
        // put 'now' line
        const nowLine = {
          x: svg.margin + graphWidth,
          y1: svg.height - 2 * svg.margin,
          y2: 35,
          label: `now ${prettyDate(now)}`,
          color: '#a00',
        }
        svg1.appendChild(
          getText(
            nowLine.label,
            nowLine.x + 13,
            nowLine.y2 + 65,
            true,
            nowLine.color
          )
        )
        svg1.appendChild(
          getLine(nowLine.x, nowLine.y1, nowLine.x, nowLine.y2, nowLine.color)
        )
      }
      //
      async function fetchLastBlocks() {
        lastBlocks = await myFetch(
          `${mainApiUrl}/blocks/${blocks.latest.height}`
        )
        lastBlocks = lastBlocks?.concat(
          await myFetch(`${mainApiUrl}/blocks/${blocks.latest.height - 10}`)
        )
        lastBlocks.forEach((block) => {
          block.x = getXbyTimestamp(block.timestamp)
          block.y1 = svg.height - 2 * svg.margin
          block.y2 = 30
          block.label = `block ${block.height}`
        })
        calcTime()
        drawSVG()
      }
      fetchLastBlocks().catch((e) => console.log('Error: ' + e.message))
    }
    populateHTML()
    displayLastBlocks()
  }
  // fetch all data and render DOM
  async function fetchData() {
    // get latest block
    let response = await fetch(apiURL('latest'))
    blocks.latest.height = parseInt(await response.text())
    response = await fetch(apiURL(blocks.latest.height))
    const latest_hash = await response.text()
    const latest = await myFetch(apiURL(latest_hash))
    // get block 2 months ago
    response = await fetch(apiURL('sixty_days'))
    const sixty_days_hash = await response.text()
    const sixty_days = await myFetch(apiURL(sixty_days_hash))
    // get stats
    const stats = await myFetch(apiURL('stats'))
    blocks.retarget.height = stats.nextretarget
    // get last retarget
    response = await fetch(apiURL('last_retarget'))
    const last_retarget_hash = await response.text()
    const last_retarget = await myFetch(apiURL(last_retarget_hash))
    // get mempool
    const mempool = await myFetch(apiURL('mempool'))
    // get usd price
    const price = await myFetch(apiURL('price'))
    // get fees
    fees = await myFetch(apiURL('fees'))
    // get average block size
    blocks.stats.avgblocksize = await myFetch(apiURL('blocksize'))
    // stats
    blocks.stats.n_tx = stats.n_tx
    blocks.stats.totalbc = stats.totalbc
    blocks.stats.hash_rate = stats.hash_rate
    blocks.stats.difficulty = stats.difficulty
    blocks.stats.market_price_usd = parseInt(price.usd)
    blocks.stats.market_price_eur = parseInt(price.eur)
    blocks.stats.mempoolsize = mempool.values.pop()
    // latest block
    blocks.latest.hash = latest_hash
    blocks.latest.timestamp = latest.timestamp
    blocks.last_retarget.height = last_retarget.height
    blocks.last_retarget.timestamp = last_retarget.timestamp
    blocks.distance.last_retarget =
      blocks.latest.height - blocks.last_retarget.height
    // sixty days block
    blocks.sixty_days.height = latest.height - blocks.distance.sixty_days
    blocks.sixty_days.timestamp = sixty_days.timestamp
    // calculate average time per block
    blocks.avg_time_block.sixty_days =
      (blocks.latest.timestamp - blocks.sixty_days.timestamp) /
      blocks.distance.sixty_days
    blocks.avg_time_block.last_retarget =
      (blocks.latest.timestamp - blocks.last_retarget.timestamp) /
      blocks.distance.last_retarget
    // future blocks
    blocks.until.halving = blocks.halving.height - blocks.latest.height
    blocks.until.retarget = blocks.retarget.height - blocks.latest.height
    blocks.time_to.halving =
      blocks.until.halving * blocks.avg_time_block.sixty_days
    blocks.time_to.retarget =
      blocks.until.retarget * blocks.avg_time_block.last_retarget
    blocks.halving.timestamp = blocks.latest.timestamp + blocks.time_to.halving
    blocks.retarget.timestamp =
      blocks.latest.timestamp + blocks.time_to.retarget
    renderDOM()
  }
  fetchData().catch((e) => console.log('Error:', e.message))
}
// fire when ready
document.addEventListener('DOMContentLoaded', () => {
  // keep lines short
  manageWait()
  initDOM()
  getFullData()
  startTimers()
})
