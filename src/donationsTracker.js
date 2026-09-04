import WindowManager from "./windowManager.js"
import { getVar } from "./gameInterface.js"
import { debugWithContext } from "./debugging.js"
import { requireElement, requireElementById } from "./dom.js"

const MAX_HISTORY_PER_PLAYER = 500
const MAX_RENDERED_ROWS = 250

const formatTime = (time) => {
  let s = Math.floor(time / 1000)
  const m = Math.floor(s / 60)
  s %= 60
  return m + (s < 10 ? ":0" : ":") + s
}

function getDonationControls() {
  let filter = document.getElementById("donationhistory_filter")
  let summary = document.getElementById("donationhistory_summary")
  if (filter && summary) return { filter, summary }

  const toolbar = document.createElement("div")
  toolbar.className = "list-toolbar"
  const label = document.createElement("label")
  label.append("Show ")
  filter = document.createElement("select")
  filter.id = "donationhistory_filter"
  ;[
    ["all", "All"],
    ["received", "Received"],
    ["sent", "Sent"]
  ].forEach(([value, text]) => {
    const option = document.createElement("option")
    option.value = value
    option.textContent = text
    filter.append(option)
  })
  summary = document.createElement("span")
  summary.id = "donationhistory_summary"
  label.append(filter)
  toolbar.append(label, summary)
  document.getElementById("donationhistory_content")?.closest("table")?.before(toolbar)
  return { filter, summary }
}

WindowManager.add({
  name: "donationHistory",
  element: requireElementById("donationhistory"),
  beforeOpen: function (isSingleplayer) {
    requireElementById("donationhistory_note").style.display =
      /*(settings.showBotDonations || isSingleplayer)*/ true ? "none" : "block"
  },
  onClose: function () {
    donationsTracker.openedWindowPlayerID = null
  },
})

const donationsTracker = new (function () {
  this.openedWindowPlayerID = null
  this.contentElement = requireElementById("donationhistory_content")
  const { filter: filterElement, summary: summaryElement } = getDonationControls()
  this.donationHistory = Array(512)
  let resetCalled = false
  let displayedHistory = []
  let displayedPlayerID = null

  function matchesFilter(item, playerID) {
    return filterElement.value === "all"
      || (filterElement.value === "received" && playerID === item[1])
      || (filterElement.value === "sent" && playerID === item[0])
  }

  function updateSummary(history, playerID) {
    let sent = 0, received = 0
    history.forEach((item) => {
      if (playerID === item[1]) received += Number(item[2]) || 0
      else sent += Number(item[2]) || 0
    })
    summaryElement.textContent = `Received ${received.toLocaleString()} · Sent ${sent.toLocaleString()}`
  }

  const renderDisplayedHistory = () => {
    this.contentElement.innerHTML = ""
    const matchingEntries = []
    for (let index = 0; index < displayedHistory.length && matchingEntries.length < MAX_RENDERED_ROWS; index++) {
      const item = displayedHistory[index]
      if (matchesFilter(item, displayedPlayerID)) matchingEntries.push([item, displayedHistory.length - index])
    }
    if (!matchingEntries.length) {
      this.contentElement.innerText = "Nothing to display"
      updateSummary(displayedHistory, displayedPlayerID)
      return
    }
    const fragment = document.createDocumentFragment()
    matchingEntries.forEach(([historyItem, originalIndex]) => {
      fragment.append(generateTableRowItem(historyItem, originalIndex, displayedPlayerID))
    })
    this.contentElement.append(fragment)
    updateSummary(displayedHistory, displayedPlayerID)
  }
  filterElement.addEventListener("change", renderDisplayedHistory)

  this.reset = function () {
    resetCalled = true
    for (var i = 0; i < 512; i++) this.donationHistory[i] = []
  }

  this.getHistoryOf = function (playerID) {
    return debugWithContext(() => this.donationHistory[playerID].slice().reverse(), {
      playerID,
      resetCalled,
      type: typeof this.donationHistory[playerID],
      isArray: Array.isArray(this.donationHistory[playerID]),
    })
  }

  this.logDonation = function (senderID, receiverID, amount, time) {
    const donationInfo = [senderID, receiverID, amount, time]
    this.donationHistory[receiverID].push(donationInfo)
    this.donationHistory[senderID].push(donationInfo)
    if (this.donationHistory[receiverID].length > MAX_HISTORY_PER_PLAYER) this.donationHistory[receiverID].shift()
    if (this.donationHistory[senderID].length > MAX_HISTORY_PER_PLAYER) this.donationHistory[senderID].shift()
    if (this.openedWindowPlayerID === senderID || this.openedWindowPlayerID === receiverID) {
      displayedHistory = this.getHistoryOf(this.openedWindowPlayerID)
      const indexOfNewItem =
        this.donationHistory[this.openedWindowPlayerID === senderID ? senderID : receiverID].length
      if (matchesFilter(donationInfo, this.openedWindowPlayerID)) {
        if (!this.contentElement.querySelector("tr")) this.contentElement.innerHTML = ""
        this.contentElement.prepend(
          generateTableRowItem(donationInfo, indexOfNewItem, this.openedWindowPlayerID, true),
        )
        if (this.contentElement.children.length > MAX_RENDERED_ROWS) this.contentElement.lastElementChild.remove()
      }
      updateSummary(displayedHistory, this.openedWindowPlayerID)
    }
  }

  function generateTableRowItem(historyItem, index, playerID, isNew) {
    const rawPlayerNames = getVar("rawPlayerNames")
    const row = document.createElement("tr")
    if (isNew) row.setAttribute("class", "new")
    const cell = document.createElement("td")
    const metadata = document.createElement("span")
    metadata.className = "color-light-gray"
    metadata.textContent = `(${formatTime(historyItem[3])}) ${index}.`
    const amount = document.createElement("span")
    amount.textContent = historyItem[2]
    const received = playerID === historyItem[1]
    amount.className = received ? "color-green" : "color-red"
    const otherPlayer = rawPlayerNames[historyItem[received ? 0 : 1]]
    cell.append(metadata, received ? " Received " : " Sent ", amount,
      received ? " resources from " : " resources to ", otherPlayer)
    row.append(cell)
    return row
  }

  this.displayHistory = function displayDonationsHistory(
    playerID,
    playerNames = getVar("rawPlayerNames"),
    isSingleplayer = getVar("gIsSingleplayer"),
  ) {
    var history = donationsTracker.getHistoryOf(playerID)
    requireElement("#donationhistory h1").textContent = "Donation history for " + playerNames[playerID]
    displayedHistory = history
    displayedPlayerID = playerID
    filterElement.value = "all"
    renderDisplayedHistory()
    this.openedWindowPlayerID = playerID
    WindowManager.openWindow("donationHistory", isSingleplayer)
  }

})()
export default donationsTracker
