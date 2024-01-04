const getById = (id) => document.getElementById(id)

const getJSON = async (url, text = false) => {
  try {
    const res = await fetch(url)
    return text ? res.text() : res.json()
  } catch {
    return null
  }
}

const getMempool = async (url, text = false) =>
  await getJSON(`https://mempool.space/api${url}`, text)

const getInfo = async (url) =>
  await getJSON(`https://api.blockchain.info${url}`)

const prettyNumber = (num) => {
  if (num == undefined) return '?'
  const language = window.navigator.language
  return new Intl.NumberFormat(language, {}).format(num)
}

const _60days = 6 * 24 * 60

let tipBlock = {}

const components = {
  blocksize: async () => {
    const json = await getInfo('/q/24hravgblocksize')
    getById('block_size').innerText = json.toFixed(2) + ' MB'
  },
  fees: async () => {
    const json = await getMempool('/v1/fees/recommended')
    getById('fees-container').innerText =
      json.fastestFee === json.minimumFee
        ? `${json.fastestFee} sats/vbyte`
        : `${json.minimumFee} to ${json.fastestFee} sats/vbyte`
    for (const id of Object.keys(json)) {
      getById(id).innerText = json[id]
    }
  },
  lastRetarget: async () => {},
  latest: async () => {
    const tip = await getMempool('/blocks/tip/height')
    let hash = await getMempool(`/block-height/${tip}`, true)
    let json = await getMempool(`/block/${hash}`)
    getById('latest-height').innerText = prettyNumber(json.height)
    getById('latest-timestamp').innerText = prettyNumber(json.timestamp)
    getById('n_blocks_total').innerText = prettyNumber(json.height)
    getById('retarget-latest-height').innerText = prettyNumber(json.height)
    getById('retarget-latest-timest').innerHTML = prettyNumber(json.timestamp)
    getById('last_block').setAttribute(
      'href',
      `https://mempool.space/block/${hash}`
    )
    hash = await getMempool(`/block-height/${json.height - _60days}`, true)
    json = await getMempool(`/block/${hash}`)
    getById('distance-blocks').innerText = `${_60days} blocks (~2 months)`
    getById('from-height').innerHTML = `${json.height} <sup>a-c</sup>`
    getById('from-timestamp').innerHTML = prettyNumber(json.timestamp)
  },
  mempool: async () => {
    const json = await getInfo(
      '/charts/mempool-size?timespan=1days&format=json&cors=true'
    )
    getById('mempool').innerText = prettyNumber(json.values.pop().y) + ' bytes'
  },
  price: async () => {
    const json = await getJSON('https://btcoracle.bordalix.workers.dev')
    getById('market_price_usd').innerText = json.usd
    getById('market_price_eur').innerText = json.eur
  },
  stats: async () => {
    json = await getInfo('/stats')
    getById('difficulty').innerText = json.difficulty.toExponential(3)
    getById('hash_rate').innerText = json.hash_rate.toExponential(3)
    getById('totalbc').innerText = prettyNumber(json.totalbc)
    getById('transactions').innerText = prettyNumber(json.n_tx)
    getById('nextretarget').innerText = prettyNumber(json.nextretarget)
    const last_retarget = json.nextretarget - 2016
    let hash = await getMempool(`/block-height/${last_retarget}`, true)
    json = await getMempool(`/block/${hash}`)
    console.log('xxxx', json)
  },
}

const updateComponents = () => {
  for (c of Object.keys(components)) components[c]()
}

document.addEventListener('DOMContentLoaded', () => updateComponents())
