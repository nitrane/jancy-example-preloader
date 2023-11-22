
let myBackgroundAPI = null
let myPreloaderId = null
let myPageId = null


module.exports = {
  
  /* jancy_props is an object used to communicate some useful infromation about
  ** your plugin to the Jancy plugin registry.
  **
  ** Required props:
  **    registryVersion (number) - tells Jancy what version of the plugin registry
  **                               this plugin was built against. Currently version
  **                               "1" is supported.
  **
  ** Optional props:
  **    enabled (boolean) - if false, tells Jancy to not enable your plugin by
  **                        default the first time it loads. Default is true.
  **
  */
  jancy_props: {
    registryVersion: 1
  },

  /* --------------------------------------------------------------------------
  ** jancy_onInit is called by the plugin registry when the plugin is loaded.
  **
  ** This is your first opportunity to iteract with Jancy.
  **
  ** Arguments:
  **    jancy (Object)
  **    enabled (boolean) -- is our plugin enabled
  ** ------------------------------------------------------------------------*/
  jancy_onInit(jancy, enabled) {
    if (enabled) {
      this.jancy_onEnabled(jancy)
    }
  },

  /* --------------------------------------------------------------------------
  ** Called by the pluginRegistry when the user has enabled us and we
  ** were previously disabled.
  **
  ** This is a good opportunity to add things to Jancy that your plugin
  ** provides.
  **
  ** Arguments:
  **    jancy (object)
  ** ------------------------------------------------------------------------*/
  jancy_onEnabled(jancy) {

    myBackgroundAPI = new BackgroundAPI(jancy)

    /* Preloaders are Jancy's version of content scripts.
    **
    ** Preloaders are registered with Jancy by calling the add method on the preloaders
    ** object on the Jancy object. The add method expects an object with the following
    ** properties.
    **
    ** urlPatterns - array of strings representing regular expressions that are used to
    **               match against URLs to determine if our preloader should run in
    **               a page.
    **
    ** pluginPath - string. Just set this equal to __dirname
    **
    ** entry - the name of a function that's been exported from this module that Jancy will
    **         call when your preloader runs.
    **
    ** jancy.preloaders.add returns a unique id for your preloader that can be used to remove
    ** it later.
    */

    const myPreloader = {
      urlPatterns: [
        '^.*stubhub\.com.*$'
      ],
      pluginPath: __dirname,
      entry: "myPreloaderFunction",
      preloaderVersion: 1
    }

    myPreloaderId = jancy.preloaders.add(myPreloader)

    /* A Jancy page is one way you can add your own user interface to Jancy
    ** (see https://docs.jancy.io/docs/developers/jancy-interfaces/page-registry).
    **
    ** Once installed, your page will be available in Jancy at the URL
    ** jancy://<your page name>
    **
    ** To add a page to Jancy you can use the add method on the pageRegistry
    ** object on the Jancy object. The add method expects two arguments:
    **
    ** pageName - a string used to access your page
    **
    ** path - path of a directory relative to this file in the plugin module that contains all the code (html, js, etc)
    **        for your page. At minimum you should have at least an index.html in this directory.
    */

    const path = require('path')
    myPageId = jancy.pageRegistry.add("example", path.join(__dirname, '../page'))

  },

  /* --------------------------------------------------------------------------
  ** Called by the pluginRegistry when the user has disabled us and
  ** we were previously enabled.
  **
  ** This is a good opportunity to remove things from Jancy that your plugin
  ** added.
  **
  ** Arguments:
  **    jancy (object)
  ** ------------------------------------------------------------------------*/
  jancy_onDisabled(jancy)  {

    /* Remove our preloader so it doesn't run anymore when the plugin is
    ** disabled.
    */
    jancy.preloaders.remove(myPreloaderId)

    /* Remove our page so it's no longer available at jancy://example.
    */
    jancy.pageRegistry.remove(myPageId)

    /* Shutdown our background API.
    */
    myBackgroundAPI.destroy()
    myBackgroundAPI = null
  },

  /* --------------------------------------------------------------------------
  ** This is the entry point of our preloader. This function runs before the
  ** webpage loads in a tab in an isolated context.
  ** ------------------------------------------------------------------------*/
  myPreloaderFunction({ jancyAPI, tab, preferences }) {

    /* myPreloaderFunction runs in the isolated context of the host webpage.
    ** Since we want to alter the host webpage, we need to inject our code that 
    ** modifies the host webpage. We can do that via some methods on the jancyAPI
    ** object.
    */

    let markup = `
      <button onclick="window.onClick()">Hello, world! Press me</button>
    `

    const css = `
      .example {
        background-color: black;
        color: white;
        z-index: 10000;
        position: absolute;
        top: 10px;
        left: 10px;
        padding: 10px;
      }
    `

    const code = `
      (function() {
        
        function inject() {

          window.jancyAPI.addStyle(\`${ css }\`)

          window.onClick = function() {            
            window.exampleAPI.sendUpdate()
          }

          const node = document.createElement('div')
          node.classList.add("example")
          node.innerHTML = \`${ markup }\`
          document.body.appendChild(node)
        }

        window.addEventListener('load', inject)
      })()
    `

    /* Before we inject our code, use the jancyAPI.exposeInMainworld method to add an object 
    ** called "exampleAPI" to the window object of the host page. The exampleAPI
    ** has function called sendUpdate that when clicked uses the ipc object on the
    ** jancyAPI object to send a message on the "example-update" channel (see BackgroundAPI below).
    */
    jancyAPI.exposeInMainWorld("exampleAPI", {
      sendUpdate() {
        jancyAPI.ipc.send('example-update')
      }
    })

    /* Inject a function that gets called immediately that adds some markup to the host webpage.
    */
    jancyAPI.executeCode(code)
  }
}


class BackgroundAPI {

  constructor(jancy) {

    this.jancy = jancy
    this.listeners = []
    this.count = 0

    /* We should first retrieve the current value of this.count from localstorage.
    ** We can use the getItem method on storeRegistry object on the Jancy object
    ** to do this (see https://docs.jancy.io/docs/developers/jancy-interfaces/store-registry).
    */
    const value = this.jancy.storeRegistry.getItem(
      "example",
      "count"
    )

    if (value) {
      this.count = JSON.parse(value)
    }

    /* The BackgroundAPI is instantiated in Jancy's main process and not
    ** a renderer process. We can use Jancy's IPC interface to listen
    ** for messages on our own custom channel and react to them.
    ** (see https://docs.jancy.io/docs/developers/jancy-interfaces/ipc)
    **
    ** Here was are setting up a couple of our own message channels.
    **
    ** example-update will be called from our preloader script when the user
    ** presses the button in the content we dynamically inject into the
    ** stubhub page. In this case we will increase "this.count" by one
    ** everytime example-update is called. After each update we'll store "this.count" 
    ** into our own localstorage using the setItem method on the storeRegistry object on 
    ** the jancy object to do this. We then broadcast out the current count to all of
    ** our pages registered via "example-register-page".
    */
    jancy.ipc.on('example-update', (event, arg) => {

      this.count++

      /* storeRegistry.setItem expects 3 arguments.
      **
      ** namespace - string used to identify a custom namespace for your storage
      ** key - string used as the name of a variable we want to store information for
      ** value - string the value to assign to "key".
      */
      this.jancy.storeRegistry.setItem(
        'example',
        'count',
        JSON.stringify(this.count)
      )

      /* Broadcast this.count to all webcontents registered via example-register-page channel
      ** below.
      */
      for (let ldx=0; ldx < this.listeners.length; ++ldx) {
        if (!jancy.ipc.sendTo(this.listeners[ldx], "example-count-updated", this.count)) {
          this.jancy.console.log(`example-plugin: removing listener ${ this.listeners[ldx] }`)
          this.listeners.splice(ldx, 1)
          --ldx;
        }
      }

    })

    /* example-register-page is a message channel that will be used by the custom
    ** example Jancy page everytime it loads (see page/index.js). 
    **
    ** Instead of using jancy.ipc.on here like the "example-update" channel, we use jancy.ipc.handle
    ** (see https://docs/jancy.io/docs/developers/jancy-interfaces/ipc) which has the ability
    ** to return a value back to the caller.
    */
    jancy.ipc.handle('example-register-page', (event, arg) => {
      /* arg is a webContent id that should be used to send an "example-count-updated" message on
      ** whenever this.count changes.
      */
      this.jancy.console.log(`example-plugin: adding listener ${ arg }`)
      this.listeners.push(arg)
      return this.count
    })
  }

  destroy() {
    // TODO we should remove our channel listeners and handle listeners add via jancyAPI.ipc.on and jancyAPI.ipc.handle.
  }
}
