
/* Any webpage hosted in a Jancy tab gets a special jancyAPI object added to their
** window object.
**
** For a Jancy page the jancyAPI has the following unique properties:
**
** getTabInfo() -- a function that returns an object with the following properties:
**
**    tabId -- string a unique identifier for this tab
**    tabContentId -- the webContentId of this tab (useful for electron apis)
**    hostContentId -- the webContentId of the window this tab is in
**
** ipcRenderer -- an object that gives pages access to the electrons ipcRenderer interface.
**                It has the following properties.
**    
**    on(channel, func) -- see https://www.electronjs.org/docs/latest/api/ipc-renderer#ipcrendereronchannel-listener
**    once(channel, func) -- see https://www.electronjs.org/docs/latest/api/ipc-renderer#ipcrendereroncechannel-listener
**    invoke (channel, args) -- see https://www.electronjs.org/docs/latest/api/ipc-renderer#ipcrendereroncechannel-listener
**    send (channel, args) -- see https://www.electronjs.org/docs/latest/api/ipc-renderer#ipcrenderersendchannel-args
**
** TODO 1. Document the other unique properties a Jancy page has access to.
** TODO 2. Document the non-unique properties the jancyAPI object has that any page in a Jancy tab
**         could use.
*/

const myTabInfo = window.jancyAPI.getTabInfo()

/* Listen for messages on the "example-count-updated" channel that the BackgroundAPI in
** src/index.js will use to notifiy listeners when the count has been updated.
*/
window.jancyAPI.ipcRenderer.on('example-count-updated', (event, count) => {
  document.body.querySelector('.click-count').innerHTML = count
})

/* Register our page as an "example-count-updated" listener with the BackgroundAPI
** in src/index.js. We receive the starting count back as return value that we use
** to set our initial value.
*/
window.jancyAPI.ipcRenderer.invoke('example-register-page', myTabInfo.tabContentId).then(count => {
  document.body.querySelector('.click-count').innerHTML = count
})
