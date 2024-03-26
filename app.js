import DHT from 'hyperdht'
import b4a from 'b4a'
import Protomux from 'protomux'
import Channel from 'jsonrpc-mux'
import {html, render} from 'lit-html'
import prettyMilliseconds from 'pretty-ms'

const editorOptions = {
  disable_collapse: true,
  disable_properties: true,
  disable_edit_json: true,
  compact: true,
  form_name_root: '',
  theme: 'spectre'
}
const dht = new DHT()

const heroSection = document.getElementById('hero-section')
const connectButton = document.getElementById('connect')
const peerKeyElement = document.getElementById('peerKey')
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
          <button id="${route.name}-button" class="btn btn-lg btn-primary">Execute</button>
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

function connect (peerKey) {
  const publicKey = b4a.from(peerKey, 'hex')
  const conn = dht.connect(publicKey)
  const framed = new Channel(new Protomux(conn))
  conn.once('open', async () => {
    const api = await framed.request('_swag', {})
    connectButton.classList.remove('loading')
    heroSection.style.display = 'none'
    document.getElementById('api').style.display = 'block'
    document.getElementById('role').innerHTML = api.role
    document.getElementById('version').innerHTML = api.version
    document.getElementById('description').innerHTML = api.description

    const routesHolder = document.getElementById('routes')
    render(routesTemplate(api.routes), routesHolder)
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
          const result = await framed.request(route.name, payload, { timeout: 10000 })
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
  })
}
