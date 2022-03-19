#!/usr/bin/env node

var USERJS = {
  arkenfox: "https://raw.githubusercontent.com/arkenfox/user.js/master/user.js",
  yokoffing: "https://raw.githubusercontent.com/yokoffing/Better-Fox/master/user.js",
  //pyllyukko: "https://raw.githubusercontent.com/pyllyukko/user.js/master/user.js",
  pyllyukko_relaxed: "https://raw.githubusercontent.com/pyllyukko/user.js/relaxed/user.js",
  //CrisBRM: "https://raw.githubusercontent.com/CrisBRM/user.js/master/user.js",
  //Narga: "https://raw.githubusercontent.com/Narga/user.js/master/user.js",
  ghacks: "https://raw.githubusercontent.com/ghacksuserjs/ghacks-user.js/master/user.js",

  // Users
  //TheReverend403: "https://raw.githubusercontent.com/TheReverend403/user.js/master/user.js",
  //"Vyral-Protoss": "https://raw.githubusercontent.com/Vyral-Protoss/user.js-pour-Firefox/master/user.js",
  //LadyDascalie: "https://raw.githubusercontent.com/LadyDascalie/userjs/master/user.js",
}

var http = require('https'), fs = require('fs'), path = require('path'),
    vm = require('vm'), bl = require('bl')

function parse_args(argv) {
  if (argv.length == 0) return { file: "index.html", type: "html" }
  if (argv.length != 1) {
    console.log('usage: compare-user.js [filename]')
    process.exit(1)
  }
  var f = argv.pop(), s = [".html", ".js"], t = s.indexOf(path.extname(f))
  if (t === -1) {
    console.log('error: extension not supported')
    process.exit(1)
  }
  return { file: f, type: s[t].substr(1) }
}

function parse_userjs(n, u, cb) {
  // https://stackoverflow.com/a/7810354
  http.get(u, function(res) {
    res.setEncoding('utf8')
    res.pipe(bl(function(e, b) {
      if (e) { console.error(e) ; process.exit(1) }
      var src = b.toString()
      var ctx = { t: {}, user_pref: function(k, v) { ctx.t[k] = v } }
      if (src.substring(0, 1) == '#') src = '// ' + src
      vm.runInNewContext(src, ctx, n + '.js')
      cb(ctx.t)
    }))
  })
  .on('error', function(e) {
    console.error(e)
    process.exit(1)
  })
}

function render_value(v) {
  if (typeof v == "string") return '"' + v + '"'
  if (v === true) return '<span style="color:green">' + v + '</span>'
  if (v === false) return '<span style="color:darkred">' + v + '</span>'
  if (v === null) return ''
  return v
}

function render_table(t) {
  var h = '', b = '', i = 0, n

  for (n in USERJS) if (USERJS.hasOwnProperty(n))
    h += '<th><a href="' + USERJS[n] + '">' + n + '</a></th>'

  for (; i < t.length; i++) {
    b += '<tr>'
    b += '<td>' + t[i].id + '</td>'
    for (n in USERJS) if (USERJS.hasOwnProperty(n)) {
      b += '<td><code>'
        + render_value(typeof t[i].value[n] == "undefined" ? null : t[i].value[n])
        +  '</code></td>'
    }
    b += '</tr>'
  }

  return '<table>'
       + '<thead><tr><th>&nbsp;</th>' + h + '</tr></thead>'
       + '<tbody>' + b + '</tbody></table>'
}

function render_page(c) {
  var s = 'body{background-color:#eee}'
        + 'a{color:#337ab7;text-decoration:none}'
        + 'main{padding:0 15px 0 15px;margin: auto}'
        + 'p,th,td{font-size:14px;line-height:1.428}'
        + 'table,th,td{border-collapse:collapse}'
        + 'tbody tr:nth-of-type(odd){background-color:#f9f9f9}'
        + 'tbody tr:hover{background-color:#f5f5f5}'
        + 'th{vertical-align:bottom;border-bottom:2px solid #ddd;text-align:left}'
        + 'th,td{padding:8px;}'
        + 'td{vertical-align:top;border-top:1px solid #ddd}'
        + 'a.r{position:absolute;top:0;right:0;border:0}'

  return '<!DOCTYPE html><html><head><meta charset="utf-8">'
       + '<title>user.js</title><style>' + s + '</style></head><body>'
       + '<main><p>Compare different <code>user.js</code>.</p>' + c + '</main>'
       + '<a href="https://github.com/jm42/compare-user.js" class="r">'
       + '<img src="https://s3.amazonaws.com/github/ribbons/forkme_right_red_aa0000.png">'
       + '</a></body></html>'
}

function render_js(t) {
  var i = 0, j = ''
  for (; i < t.length; i++)
    if (typeof t[i].value["custom"] != "undefined")
      j += 'user_pref("' + t[i].id + '", '
        +  (typeof t[i].value["custom"] == "string"
             ? '"' + t[i].value["custom"] + '"'
             : t[i].value["custom"])
        +  ');\n'
  return '// Mozilla User Preferences\n'
       + '// This file is managed by compare-user.js, don\'t make changes here, they\n'
       + '// will be overwritten.\n\n' + j
}

function compare(t) {
  var i = 0, n, v, k
  for (; i < t.length; i++) {
    v = {}
    for (n in USERJS) if (USERJS.hasOwnProperty(n))
      if (typeof t[i].value[n] != "undefined")
        v[t[i].value[n]] = typeof v[t[i].value[n]] == "undefined" ? 1
                         : v[t[i].value[n]] + 1
    if (Object.keys(v).length == 1) { // there's only one value
      k = Object.keys(v).pop()
      // Unanimous or more than 50% of votes for a value to enter custom
      if (v[k] == Object.keys(USERJS).length || v[k] * 100 / Object.keys(USERJS).length >= 50)
        switch (true) {
          case k == "true": t[i].value['custom'] = true ; break
          case k == "false": t[i].value['custom'] = false ; break
          case k == "": t[i].value['custom'] = k ; break
          case !isNaN(k): t[i].value['custom'] = parseInt(k) ; break
          default: t[i].value['custom'] = k
        }
    }
  }
  USERJS['custom'] = 'user.js'
  return t
}

function main(opts) {
  var n, r, k, c = 1, t = {}
  for (n in USERJS) if (USERJS.hasOwnProperty(n)) {
    parse_userjs(n, USERJS[n], function(n) { return function(r) {
      for (k in r) if (r.hasOwnProperty(k)) {
        if (typeof t[k] == "undefined")
          t[k] = {}
        t[k][n] = r[k]
      }
      if (c++ >= Object.keys(USERJS).length) {
        // https://stackoverflow.com/a/30132433
        // https://stackoverflow.com/a/24080786
        t = Object.keys(t)
                  .map(function(k) { return { id: k, value: t[k] } })
                  .sort(function(a, b) { return +(a.id > b.id) || -(a.id < b.id) })
        t = compare(t)
        // https://stackoverflow.com/a/21617560
        var stream = fs.createWriteStream(opts.file).once("open", function() {
          var o = ''
          switch (opts.type) {
            case "html": o = render_page(render_table(t)) ; break
            case "js": o = render_js(t) ; break
          }
          stream.end(o)
        })
      }
    }}(n))
  }
}

main(parse_args(process.argv.slice(2)))
