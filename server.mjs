import 'dotenv/config'
const SERVER_NAME = process.env.SERVER_NAME
const STATUS_URL = "https://www.playlostark.com/en-us/support/server-status"
const FAVICON = "https://d3irh93dd5ckql.cloudfront.net/statics/2025-08-19/images/LostArkIcon.png"
let statusCache = {}

const getServerStatus = async () => {
  const text = await fetch(STATUS_URL)
    .then(res => res.text())
  // strip via regex
  const serverRegex = new RegExp(/<div aria-label="(.+)" class="ags-ServerStatus-content-responses-response-server-name">/g)
  const serverStatus = text
    .matchAll(serverRegex)
    .map(server => server[1].split(" is "))
    .reduce((acc, [name, status]) => ({ ...acc, [name]: status }), {})
  return serverStatus
}

const serverKvCheck = async (serverStatus, send = true) => {
  const newStatus = serverStatus[SERVER_NAME]
  const kvStatus = statusCache[SERVER_NAME]
  if (!newStatus || !kvStatus) {
    // don't send
    return
  }
  if (kvStatus !== newStatus ) { // debug always notify
    statusCache[SERVER_NAME] = newStatus
    if (send) await postDiscord(newStatus)
  }
}

const postDiscord = async (status) => {
  const colorMap = {
    "online": 0x2ECC71,
    "busy": 0xF1C40F,
    "full": 0xE67E22,
    "maintenance": 0xE74C3C
  }
  const emojiMap = {
    "online": "🟢",
    "busy": "🟡",
    "full": "🟠",
    "maintenance": "🛠️"
  }

  const payload = {
    username: process.env.WEBHOOK_NAME || "Lost Ark Status",
    avatar_url: process.env.WEBHOOK_AVATAR || FAVICON,
    embeds: [{
      title: `${emojiMap[status]} ${SERVER_NAME} is ${status}`,
      url: STATUS_URL,
      color: colorMap[status],
      timestamp: new Date().toISOString(),
    }]
  }

  return fetch(process.env.WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).then(res => {
    if (!res.ok) {
      console.error(`Error posting to Discord: ${res.status} ${res.statusText}`)
    }
    return res
  })
}

function main() {
  console.log(`Starting Lost Ark Status Monitor for ${SERVER_NAME}`)
  // initial fetch
  getServerStatus()
    .then(serverStatus => serverKvCheck(serverStatus, false)) // don't notify on first run
    .catch(console.error)

  // poll every 1 minutes
  setInterval(() => {
    getServerStatus()
      .then(serverStatus => serverKvCheck(serverStatus))
      .catch(console.error)
  }, 60 * 1000)
}
main()