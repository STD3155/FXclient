import WindowManager from "./windowManager.js"
import { getVar } from "./gameInterface.js"
import { debugWithContext } from "./debugging.js"

const MAX_HISTORY_PER_PLAYER = 500
const MAX_RENDERED_ROWS = 250

const formatTime = (time) => {
  let s = Math.floor(time / 1000)
  const m = Math.floor(s / 60)
  s %= 60
  return m + (s < 10 ? ":0" : ":") + s
}

WindowManager.add({
  name: "donationHistory",
  element: document.querySelector("#donationhistory"),
  beforeOpen: function (isSingleplayer) {
    document.getElementById("donationhistory_note").style.display =
      /*(settings.showBotDonations || isSingleplayer)*/ true ? "none" : "block"
  },
  onClose: function () {
    donationsTracker.openedWindowPlayerID = null
  },
})

const donationsTracker = new (function () {
  this.openedWindowPlayerID = null
  this.contentElement = document.querySelector("#donationhistory_content")
  this.donationHistory = Array(512)
  let resetCalled = false

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
      const indexOfNewItem =
        this.donationHistory[this.openedWindowPlayerID === senderID ? senderID : receiverID].length
      if (indexOfNewItem === 1) this.contentElement.innerHTML = ""
      this.contentElement.prepend(
        generateTableRowItem(donationInfo, indexOfNewItem, this.openedWindowPlayerID, true),
      )
      if (this.contentElement.children.length > MAX_RENDERED_ROWS) this.contentElement.lastElementChild.remove()
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
    document.querySelector("#donationhistory h1").textContent = "Donation history for " + playerNames[playerID]
    this.contentElement.innerHTML = ""
    if (history.length > 0) {
      const fragment = document.createDocumentFragment()
      history.slice(0, MAX_RENDERED_ROWS).forEach((historyItem, index) => {
        fragment.append(generateTableRowItem(historyItem, history.length - index, playerID))
      })
      this.contentElement.append(fragment)
    }
    else this.contentElement.innerText = "Nothing to display"
    this.openedWindowPlayerID = playerID
    WindowManager.openWindow("donationHistory", isSingleplayer)
  }

})()
export default donationsTracker
