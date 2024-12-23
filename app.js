import DHT from 'hyperdht'
import hie from 'hypercore-id-encoding'
import Protomux from 'protomux'
import Channel from 'jsonrpc-mux'
import {html, render} from 'lit-html'
import prettyMilliseconds from 'pretty-ms'
const defaultRoute = '/_swag.json' // should import this from swag

const { teardown } = Pear

const editorOptions = {
  disable_collapse: true,
  disable_properties: true,
  disable_edit_json: true,
  compact: true,
  form_name_root: '',
  theme: 'spectre'
}
const dht = new DHT()
teardown(() => dht.destroy())
const errorSection = document.getElementById('error-section')
const errorMessage = document.getElementById('error-message')
const heroSection = document.getElementById('hero-section')
const connectButton = document.getElementById('connect')
const peerKeyElement = document.getElementById('peerKey')

if (Pear.config.linkData) {
  peerKeyElement.value = Pear.config.linkData
  connectButton.classList.add('loading')
  connect(peerKeyElement.value)
} else {
  heroSection.style.display = 'block'
}

connectButton.addEventListener('click', () => {
  connectButton.classList.add('loading')
  destroy()
  connect(peerKeyElement.value)
})

function destroy () {
    document.getElementById('api').style.display = 'none'
    document.getElementById('role').innerHTML = ''
    document.getElementById('version').innerHTML = ''
    document.getElementById('description').innerHTML = ''
}


const paramTemplate = (name, param) => {
  if (param.not) return html`<p>no parameters</p>`
  return html`
  <div id="${name}-param"></div>
`
}

const headerTemplate = (name, header) => {
  if (header.not) return html`<p>no headers</p>`
  return html`
<div>
  <div id="${name}-header"></div>
</div>
`
}

const routeTemplate = (route) => html`
    <div class="card">
      <div class="card-header">
        <div class="card-title h5">${route.name}</div>
      </div>
      <div class="card-body">
        <div class="tile">
          <div class="tile-icon">
            <div class="example-tile-icon">
              <i class="icon icon-apps centered"></i>
            </div>
          </div>
          <div class="tile-content">
            <p class="tile-title">Paramters</p>
            <p class="tile-subtitle">
              ${paramTemplate(route.name, route.paramSchema)}
            <p>
          </div>
        </div>
        <div class="tile">
          <div class="tile-icon">
            <div class="example-tile-icon">
              <i class="icon icon-people centered"></i>
            </div>
          </div>
          <div class="tile-content">
            <p class="tile-title">Headers</p>
            <p class="tile-subtitle">
              ${headerTemplate(route.name, route.headerSchema)}
            <p>
          </div>
        </div>
        <div>
          <button id="${route.name}-button" class="btn btn-lg btn-primary">Submit</button>
        </div>
      </div>

      <div class="card-footer">
        <div id="${route.name}-response" class="container response">
          <div class="columns">
            <div class="column col-2">
              <p class="text-tiny">Status</p>
            </div>
            <div class="column col-10">
              <span id="${route.name}-status" class="label label-rounded">Ok</span>
            </div>
          </div>
          <div class="columns timestamp-row">
            <div class="column col-2">
              <p class="text-tiny">Time</p>
            </div>
            <div class="column col-10">
              <span id="${route.name}-time"></span>
            </div>
          </div>
          <div class="columns">
            <div class="column col-2">
              <p class="text-tiny response-th">Response</p>
            </div>
            <div class="column col-10">
              <pre id="${route.name}-response-pre" class="code">
                <code id="${route.name}-response-code"></code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
`

const routeTemplateAccordian = (route) => html`
<div class="accordion">
  <input type="checkbox" id="accordion-${route.name}" name="accordion-1" hidden>
  <label class="accordion-header" for="accordion-${route.name}">
    <i class="icon icon-arrow-right mr-1"></i>
    ${route.name}
  </label>
  <div class="accordion-body">
    ${routeTemplate(route)}
  </div>
</div>
`
const routesTemplate = (routes) => (routes.length > 1) ?
  html`<div>${routes.map(routeTemplateAccordian)}</div>` : html`<div>${routeTemplate(routes[0])}</div>`

function onErrorConnection (message) {
  console.log('on error connection', message)
  errorSection.style.display = 'block'
  errorMessage.innerHTML = message
  heroSection.style.display = 'none'
  connectButton.classList.remove('loading')
}


function connect (peerKey, route) {
  let publicKey = null
  let conn = null
  try {
    publicKey = hie.decode(peerKey)
    conn = dht.connect(publicKey)
  } catch (e) { return onErrorConnection(e.toString()) }
  conn.on('error', (e) => onErrorConnection(e.toString()))
  conn.on('close', () => {
    console.log('the connection is closed')
  })
  const swagRoute = route || defaultRoute // could read from the end of the input
  
  const framed = new Channel(new Protomux(conn))
  conn.once('open', async () => {
    const api = await framed.request(swagRoute, {})
    connectButton.classList.remove('loading')
    heroSection.style.display = 'none'
    errorSection.style.display = 'none'
    document.getElementById('api').style.display = 'block'
    document.getElementById('role').innerHTML = api.role
    document.getElementById('version').innerHTML = api.version
    document.getElementById('description').innerHTML = api.description

    const routesHolder = document.getElementById('routes')
    render(routesTemplate(api.routes), routesHolder)

    // if there is Pear.config.linkData and only one route, go into form mode! 
    if (Pear.config.linkData && api.routes.length === 1) {
      // hide the nav 
      document.getElementById('navbar').style.display = 'none'
      // hide any element with class with hero
      document.querySelectorAll('.hero').forEach(el => el.style.display = 'none')
    } else {

      // make a download link
      const downloadEl = document.getElementById('downloadJSON')
      const name = `${peerKey}${swagRoute}`
      downloadEl.setAttribute('href', 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(api, null, 2)))
      downloadEl.setAttribute('download', name)
    }

    api.routes.forEach(route => {
      let paramEditor = null
      let headerEditor = null
      if (!route.paramSchema.not) {
        const el = document.getElementById(`${route.name}-param`)
        paramEditor = new JSONEditor(el, { schema: route.paramSchema, ...editorOptions }) 
      }
      if (!route.headerSchema.not) {
        const el = document.getElementById(`${route.name}-header`)
        headerEditor = new JSONEditor(el, { schema: route.headerSchema, ...editorOptions}) 
      }
      const executeButton = document.getElementById(`${route.name}-button`)
      executeButton.addEventListener('click', async () => {
        executeButton.classList.add('loading')
        const payload = {}
        if (paramEditor) payload.params = paramEditor.getValue()
        if (headerEditor) payload.headers = headerEditor.getValue()
        const start = Date.now()
        let end = null

        const responseHolder = document.getElementById(`${route.name}-response`)
        const preElement = document.getElementById(`${route.name}-response-pre`)
        const codeElement = document.getElementById(`${route.name}-response-code`)
        const statusElement = document.getElementById(`${route.name}-status`)
        const timeElement = document.getElementById(`${route.name}-time`)
        try {
          const path = `/agreement/${api.role}@${api.version}/${route.name}`
          const result = await framed.request(path, payload, { timeout: 10000 })
          const returnType = route?.returnSchema?.type || 'void'
          if (returnType === 'object') codeElement.innerHTML = JSON.stringify(result, null, 4)
          else codeElement.innerHTML = result
          preElement.setAttribute('data-lang', returnType);
          statusElement.innerHTML = 'Ok'
          statusElement.classList.remove('label-error')
          statusElement.classList.add('label-success')
        } catch (e) {
          const message = e.toString()
          codeElement.innerHTML = message
          preElement.setAttribute('data-lang', 'error')
          statusElement.innerHTML = 'Not Ok'
          statusElement.classList.add('label-error')
          statusElement.classList.remove('label-success')
        } finally {
          executeButton.classList.remove('loading')
          responseHolder.style.display = 'block'
          end = Date.now()
          const time = end - start
          console.log('response time', time)
          timeElement.innerHTML = prettyMilliseconds(time)
        }
      })
    })
    try {
      const agreementRoute = `/_agreement.mjs`
      // this part is optional. Try and grab the contract
      const mjs = await framed.request(agreementRoute, {})
      console.log(mjs)
      // make a download link
      const mjsDownloadEl = document.getElementById('downloadMJS')
      const name = `${peerKey}${agreementRoute}`
      mjsDownloadEl.setAttribute('href', 'data:text/javascript;charset=utf-8,' + encodeURIComponent(mjs))
      mjsDownloadEl.setAttribute('download', name)
      // mjsDownloadEl.innerHTML = `${contractRoute}`
    } catch (e) {
      mjsDownloadEl.style.display = 'none'
      console.log('error', e)
    }
  })
}
