/**
 * 自动生成的DNR JS重定向规则
 * 生成时间: 2026-05-10T12:17:04.893Z
 * 规则数量: 435
 * 规则ID范围: 4001-4435
 */

const AUTO_GENERATED_JS_REDIRECT_RULES = [
  {
    id: 4001,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/jquery/\\1/jquery.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://code\\.jquery\\.com/[^-]+-([\\d.]+)(?:\\.min)?\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4002,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/jquery/3.7.1/jquery.min.js',
      },
    },
    condition: {
      urlFilter: '*://code.jquery.com/jquery-*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4003,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/jquery/\\1/jquery.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://ajax\\.googleapis\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4004,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/jquery/3.7.1/jquery.min.js',
      },
    },
    condition: {
      urlFilter: '*://ajax.googleapis.com/ajax/libs/jquery/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4005,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/jquery/\\1/jquery.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4006,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/jquery/3.7.1/jquery.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/jquery/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4007,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/jquery/\\1/jquery.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/jquery@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4008,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/jquery/3.7.1/jquery.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/jquery/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4009,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/jquery/\\1/jquery.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/jquery@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4010,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/jquery/3.7.1/jquery.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/jquery/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4011,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/react/\\1/umd/react.production.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/react@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4012,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/react/18.2.0/umd/react.production.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/react/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4013,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/react/\\1/umd/react.production.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/react@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4014,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/react/18.2.0/umd/react.production.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/react/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4015,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/react/\\1/umd/react.production.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4016,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/react/18.2.0/umd/react.production.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/react/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4017,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution:
          'https://cdn.staticfile.org/react-dom/\\1/umd/react-dom.production.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/react-dom@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4018,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/react-dom/18.2.0/umd/react-dom.production.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/react-dom/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4019,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution:
          'https://cdn.staticfile.org/react-dom/\\1/umd/react-dom.production.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/react-dom@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4020,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/react-dom/18.2.0/umd/react-dom.production.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/react-dom/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4021,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution:
          'https://cdn.staticfile.org/react-dom/\\1/umd/react-dom.production.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4022,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/react-dom/18.2.0/umd/react-dom.production.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/react-dom/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4023,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/vue/\\1/dist/vue.global.prod.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/vue@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4024,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/vue/3.4.21/dist/vue.global.prod.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/vue/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4025,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/vue/\\1/dist/vue.global.prod.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/vue@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4026,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/vue/3.4.21/dist/vue.global.prod.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/vue/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4027,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/vue/\\1/dist/vue.global.prod.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4028,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/vue/3.4.21/dist/vue.global.prod.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/vue/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4029,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/lodash/\\1/lodash.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/lodash@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4030,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/lodash/4.17.21/lodash.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/lodash/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4031,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/lodash/\\1/lodash.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/lodash@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4032,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/lodash/4.17.21/lodash.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/lodash/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4033,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/lodash/\\1/lodash.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4034,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/lodash/4.17.21/lodash.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/lodash.js/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4035,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/axios/\\1/dist/axios.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/axios@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4036,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/axios/1.6.7/dist/axios.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/axios/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4037,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/axios/\\1/dist/axios.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/axios@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4038,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/axios/1.6.7/dist/axios.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/axios/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4039,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/axios/\\1/dist/axios.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4040,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/axios/1.6.7/dist/axios.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/axios/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4041,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/moment/\\1/min/moment.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/moment@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4042,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/moment/2.30.1/min/moment.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/moment/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4043,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/moment/\\1/min/moment.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/moment@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4044,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/moment/2.30.1/min/moment.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/moment/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4045,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/moment/\\1/min/moment.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4046,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/moment/2.30.1/min/moment.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/moment.js/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4047,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/echarts/\\1/dist/echarts.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/echarts@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4048,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/echarts/5.5.0/dist/echarts.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/echarts/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4049,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/echarts/\\1/dist/echarts.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/echarts@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4050,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/echarts/5.5.0/dist/echarts.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/echarts/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4051,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/echarts/\\1/dist/echarts.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4052,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/echarts/5.5.0/dist/echarts.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/echarts/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4053,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/d3/\\1/dist/d3.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/d3@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4054,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/d3/7.8.5/dist/d3.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/d3/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4055,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/d3/\\1/dist/d3.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/d3@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4056,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/d3/7.8.5/dist/d3.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/d3/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4057,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/d3/\\1/dist/d3.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4058,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/d3/7.8.5/dist/d3.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/d3/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4059,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/chart.js@\\1/dist/chart.umd.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/chart.js@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4060,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/chart.js/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4061,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/chart.js@\\1/dist/chart.umd.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/chart.js@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4062,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/chart.js/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4063,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/chart.js@\\1/dist/chart.umd.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4064,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/Chart.js/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4065,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/three/\\1/build/three.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/three@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4066,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/three/0.168.0/build/three.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/three/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4067,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/three/\\1/build/three.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/three@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4068,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/three/0.168.0/build/three.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/three/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4069,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/three/\\1/build/three.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4070,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/three/0.168.0/build/three.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/three.js/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4071,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/dayjs/\\1/dayjs.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/dayjs@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4072,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/dayjs/1.11.10/dayjs.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/dayjs/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4073,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/dayjs/\\1/dayjs.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/dayjs@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4074,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/dayjs/1.11.10/dayjs.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/dayjs/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4075,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/dayjs/\\1/dayjs.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4076,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/dayjs/1.11.10/dayjs.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/dayjs/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4077,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/animejs@\\1/lib/anime.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/animejs@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4078,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/animejs@3.2.2/lib/anime.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/animejs/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4079,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/animejs@\\1/lib/anime.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/animejs@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4080,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/animejs@3.2.2/lib/anime.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/animejs/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4081,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/animejs@\\1/lib/anime.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4082,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/animejs@3.2.2/lib/anime.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/animejs/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4083,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/hammerjs/\\1/hammer.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/hammerjs@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4084,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/hammerjs/2.0.8/hammer.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/hammerjs/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4085,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/hammerjs/\\1/hammer.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/hammerjs@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4086,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/hammerjs/2.0.8/hammer.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/hammerjs/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4087,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/hammerjs/\\1/hammer.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4088,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/hammerjs/2.0.8/hammer.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/hammer.js/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4089,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/jquery-ui/\\1/dist/jquery-ui.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://code\\.jquery\\.com/ui/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4090,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/jquery-ui/1.13.2/dist/jquery-ui.min.js',
      },
    },
    condition: {
      urlFilter: '*://code.jquery.com/ui/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4091,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/jquery-ui/\\1/dist/jquery-ui.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/jquery-ui@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4092,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/jquery-ui/1.13.2/dist/jquery-ui.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/jquery-ui/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4093,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/jquery-ui/\\1/dist/jquery-ui.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4094,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/jquery-ui/1.13.2/dist/jquery-ui.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/jqueryui/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4095,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/bootstrap/\\1/dist/js/bootstrap.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://stackpath\\.bootstrapcdn\\.com/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4096,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/bootstrap/5.3.3/dist/js/bootstrap.min.js',
      },
    },
    condition: {
      urlFilter: '*://stackpath.bootstrapcdn.com/bootstrap/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4097,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/bootstrap/\\1/dist/js/bootstrap.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://maxcdn\\.bootstrapcdn\\.com/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4098,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/bootstrap/5.3.3/dist/js/bootstrap.min.js',
      },
    },
    condition: {
      urlFilter: '*://maxcdn.bootstrapcdn.com/bootstrap/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4099,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/bootstrap/\\1/dist/js/bootstrap.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/bootstrap@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4100,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/bootstrap/5.3.3/dist/js/bootstrap.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/bootstrap/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4101,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/bootstrap/\\1/dist/js/bootstrap.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/bootstrap@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4102,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/bootstrap/5.3.3/dist/js/bootstrap.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/bootstrap/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4103,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/@popperjs/core/\\1/dist/umd/popper.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/@popperjs\\/core@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4104,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/@popperjs/core/2.11.8/dist/umd/popper.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/@popperjs/core/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4105,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/@popperjs/core/\\1/dist/umd/popper.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/@popperjs\\/core@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4106,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/@popperjs/core/2.11.8/dist/umd/popper.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/@popperjs/core/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4107,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/@popperjs/core/\\1/dist/umd/popper.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4108,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/@popperjs/core/2.11.8/dist/umd/popper.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/popper.js/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4109,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/swiper/\\1/swiper-bundle.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/swiper@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4110,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/swiper/11.0.5/swiper-bundle.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/swiper/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4111,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/swiper/\\1/swiper-bundle.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/swiper@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4112,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/swiper/11.0.5/swiper-bundle.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/swiper/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4113,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/swiper/\\1/swiper-bundle.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4114,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/swiper/11.0.5/swiper-bundle.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/Swiper/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4115,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/select2/\\1/dist/js/select2.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/select2@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4116,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/select2/4.0.13/dist/js/select2.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/select2/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4117,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/select2/\\1/dist/js/select2.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/select2@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4118,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/select2/4.0.13/dist/js/select2.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/select2/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4119,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/select2/\\1/dist/js/select2.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4120,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/select2/4.0.13/dist/js/select2.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/select2/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4121,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/gsap/\\1/dist/gsap.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/gsap@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4122,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/gsap/3.12.5/dist/gsap.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/gsap/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4123,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/gsap/\\1/dist/gsap.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/gsap@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4124,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/gsap/3.12.5/dist/gsap.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/gsap/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4125,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/gsap/\\1/dist/gsap.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4126,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/gsap/3.12.5/dist/gsap.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/gsap/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4127,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution:
          'https://cdn.staticfile.org/@fortawesome/fontawesome-free/\\1/js/all.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://use\\.fontawesome\\.com/releases/v?([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4128,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/@fortawesome/fontawesome-free/6.5.1/js/all.min.js',
      },
    },
    condition: {
      urlFilter: '*://use.fontawesome.com/releases/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4129,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution:
          'https://cdn.staticfile.org/@fortawesome/fontawesome-free/\\1/js/all.min.js',
      },
    },
    condition: {
      regexFilter:
        '^https?://cdn\\.jsdelivr\\.net/npm/@fortawesome\\/fontawesome-free@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4130,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/@fortawesome/fontawesome-free/6.5.1/js/all.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4131,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution:
          'https://cdn.staticfile.org/@fortawesome/fontawesome-free/\\1/js/all.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4132,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/@fortawesome/fontawesome-free/6.5.1/js/all.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/font-awesome/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4133,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/tailwindcss@3.4.1/lib/index.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.tailwindcss.com/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4134,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/tailwindcss@\\1/lib/index.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/tailwindcss@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4135,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/tailwindcss@3.4.1/lib/index.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/tailwindcss/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4136,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/alpinejs@\\1/dist/cdn.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/alpinejs@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4137,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/alpinejs@3.13.5/dist/cdn.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/alpinejs/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4138,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/alpinejs@\\1/dist/cdn.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/alpinejs@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4139,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/alpinejs@3.13.5/dist/cdn.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/alpinejs/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4140,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/htmx.org@\\1/dist/htmx.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/htmx.org@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4141,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/htmx.org@1.9.10/dist/htmx.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/htmx.org/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4142,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/htmx.org@\\1/dist/htmx.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/htmx.org@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4143,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/htmx.org@1.9.10/dist/htmx.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/htmx.org/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4144,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/underscore/\\1/underscore-umd-min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/underscore@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4145,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/underscore/1.13.6/underscore-umd-min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/underscore/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4146,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/underscore/\\1/underscore-umd-min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/underscore@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4147,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/underscore/1.13.6/underscore-umd-min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/underscore/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4148,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/underscore/\\1/underscore-umd-min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4149,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/underscore/1.13.6/underscore-umd-min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/underscore.js/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4150,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/backbone/\\1/backbone-min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/backbone@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4151,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/backbone/1.5.0/backbone-min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/backbone/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4152,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/backbone/\\1/backbone-min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/backbone@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4153,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/backbone/1.5.0/backbone-min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/backbone/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4154,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/backbone/\\1/backbone-min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4155,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/backbone/1.5.0/backbone-min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/backbone.js/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4156,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/@angular/core@\\1/bundles/core.umd.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/@angular\\/core@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4157,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/@angular/core@17.2.4/bundles/core.umd.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/@angular/core/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4158,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/@angular/core@\\1/bundles/core.umd.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/@angular\\/core@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4159,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/@angular/core@17.2.4/bundles/core.umd.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/@angular/core/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4160,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/@angular/core@\\1/bundles/core.umd.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://ajax\\.googleapis\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4161,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/@angular/core@17.2.4/bundles/core.umd.min.js',
      },
    },
    condition: {
      urlFilter: '*://ajax.googleapis.com/ajax/libs/angularjs/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4162,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/svelte@\\1/internal/index.mjs',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/svelte@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4163,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/svelte@4.2.12/internal/index.mjs',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/svelte/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4164,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/svelte@\\1/internal/index.mjs',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/svelte@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4165,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/svelte@4.2.12/internal/index.mjs',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/svelte/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4166,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution:
          'https://cdn.jsdelivr.net/npm/socket.io-client@\\1/dist/socket.io.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/socket.io-client@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4167,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/socket.io-client@4.7.5/dist/socket.io.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/socket.io-client/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4168,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution:
          'https://cdn.jsdelivr.net/npm/socket.io-client@\\1/dist/socket.io.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/socket.io-client@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4169,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/socket.io-client@4.7.5/dist/socket.io.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/socket.io-client/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4170,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution:
          'https://cdn.jsdelivr.net/npm/socket.io-client@\\1/dist/socket.io.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4171,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/socket.io-client@4.7.5/dist/socket.io.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/socket.io/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4172,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@\\1/build/pdf.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/pdfjs-dist@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4173,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/pdfjs-dist/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4174,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@\\1/build/pdf.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/pdfjs-dist@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4175,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/pdfjs-dist/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4176,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@\\1/build/pdf.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4177,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/pdf.js/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4178,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/video.js/\\1/dist/video.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/video.js@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4179,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/video.js/8.10.0/dist/video.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/video.js/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4180,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/video.js/\\1/dist/video.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/video.js@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4181,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/video.js/8.10.0/dist/video.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/video.js/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4182,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/video.js/\\1/dist/video.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4183,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/video.js/8.10.0/dist/video.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/video.js/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4184,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/video.js/\\1/dist/video.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://vjs\\.zencdn\\.net//([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4185,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/video.js/8.10.0/dist/video.min.js',
      },
    },
    condition: {
      urlFilter: '*://vjs.zencdn.net/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4186,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/howler@\\1/dist/howler.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/howler@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4187,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/howler@2.2.4/dist/howler.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/howler/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4188,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/howler@\\1/dist/howler.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/howler@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4189,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/howler@2.2.4/dist/howler.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/howler/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4190,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/howler@\\1/dist/howler.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4191,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/howler@2.2.4/dist/howler.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/howler/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4192,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/numeral/\\1/min/numeral.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/numeral@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4193,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/numeral/2.0.6/min/numeral.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/numeral/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4194,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/numeral/\\1/min/numeral.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/numeral@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4195,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/numeral/2.0.6/min/numeral.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/numeral/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4196,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/numeral/\\1/min/numeral.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4197,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/numeral/2.0.6/min/numeral.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/numeral.js/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4198,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/accounting/\\1/accounting.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/accounting@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4199,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/accounting/0.4.2/accounting.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/accounting/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4200,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/accounting/\\1/accounting.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/accounting@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4201,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/accounting/0.4.2/accounting.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/accounting/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4202,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/accounting/\\1/accounting.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4203,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/accounting/0.4.2/accounting.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/accounting.js/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4204,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/marked@\\1/marked.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/marked@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4205,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/marked@12.0.1/marked.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/marked/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4206,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/marked@\\1/marked.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/marked@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4207,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/marked@12.0.1/marked.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/marked/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4208,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/marked@\\1/marked.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4209,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/marked@12.0.1/marked.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/marked/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4210,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/highlight.js/\\1/highlight.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/highlight.js@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4211,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/highlight.js/11.9.0/highlight.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/gh/highlightjs/cdn-release/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4212,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/highlight.js/\\1/highlight.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4213,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/highlight.js/11.9.0/highlight.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/highlight.js/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4214,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/prismjs/\\1/prism.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/prismjs@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4215,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/prismjs/1.29.0/prism.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/prismjs/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4216,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/prismjs/\\1/prism.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/prismjs@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4217,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/prismjs/1.29.0/prism.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/prismjs/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4218,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/prismjs/\\1/prism.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4219,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/prismjs/1.29.0/prism.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/prism/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4220,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/validator@\\1/validator.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/validator@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4221,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/validator@13.11.0/validator.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/validator/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4222,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/validator@\\1/validator.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/validator@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4223,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/validator@13.11.0/validator.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/validator/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4224,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/uuid@\\1/dist/umd/uuid.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/uuid@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4225,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/uuid@9.0.1/dist/umd/uuid.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/uuid/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4226,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/uuid@\\1/dist/umd/uuid.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/uuid@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4227,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/uuid@9.0.1/dist/umd/uuid.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/uuid/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4228,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/uuid@\\1/dist/umd/uuid.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4229,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/uuid@9.0.1/dist/umd/uuid.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/uuid/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4230,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/crypto-js/\\1/crypto-js.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/crypto-js@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4231,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/crypto-js/4.2.0/crypto-js.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/crypto-js/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4232,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/crypto-js/\\1/crypto-js.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/crypto-js@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4233,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/crypto-js/4.2.0/crypto-js.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/crypto-js/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4234,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/crypto-js/\\1/crypto-js.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4235,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/crypto-js/4.2.0/crypto-js.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/crypto-js/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4236,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/js-cookie@\\1/dist/js.cookie.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/js-cookie@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4237,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/js-cookie@3.0.5/dist/js.cookie.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/js-cookie/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4238,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/js-cookie@\\1/dist/js.cookie.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/js-cookie@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4239,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/js-cookie@3.0.5/dist/js.cookie.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/js-cookie/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4240,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/js-cookie@\\1/dist/js.cookie.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4241,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/js-cookie@3.0.5/dist/js.cookie.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/js-cookie/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4242,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/store@\\1/dist/store.legacy.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/store@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4243,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/store@2.0.12/dist/store.legacy.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/store/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4244,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/store@\\1/dist/store.legacy.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/store@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4245,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/store@2.0.12/dist/store.legacy.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/store/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4246,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/store@\\1/dist/store.legacy.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4247,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/store@2.0.12/dist/store.legacy.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/store.js/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4248,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/localforage@\\1/dist/localforage.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/localforage@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4249,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/localforage@1.10.0/dist/localforage.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/localforage/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4250,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/localforage@\\1/dist/localforage.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/localforage@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4251,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/localforage@1.10.0/dist/localforage.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/localforage/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4252,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/localforage@\\1/dist/localforage.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4253,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/localforage@1.10.0/dist/localforage.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/localforage/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4254,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/pako@\\1/dist/pako.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/pako@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4255,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/pako/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4256,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/pako@\\1/dist/pako.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/pako@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4257,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/pako/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4258,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/pako@\\1/dist/pako.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4259,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/pako/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4260,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/lz-string@\\1/libs/lz-string.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/lz-string@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4261,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/lz-string@1.5.0/libs/lz-string.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/lz-string/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4262,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/lz-string@\\1/libs/lz-string.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/lz-string@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4263,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/lz-string@1.5.0/libs/lz-string.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/lz-string/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4264,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/lz-string@\\1/libs/lz-string.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4265,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/lz-string@1.5.0/libs/lz-string.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/lz-string/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4266,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/mathjs@\\1/lib/browser/math.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/mathjs@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4267,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/mathjs@12.4.1/lib/browser/math.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/mathjs/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4268,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/mathjs@\\1/lib/browser/math.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/mathjs@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4269,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/mathjs@12.4.1/lib/browser/math.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/mathjs/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4270,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/mathjs@\\1/lib/browser/math.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4271,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/mathjs@12.4.1/lib/browser/math.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/mathjs/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4272,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/ramda/\\1/dist/ramda.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/ramda@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4273,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/ramda/0.29.1/dist/ramda.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/ramda/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4274,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/ramda/\\1/dist/ramda.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/ramda@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4275,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/ramda/0.29.1/dist/ramda.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/ramda/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4276,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/ramda/\\1/dist/ramda.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4277,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/ramda/0.29.1/dist/ramda.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/ramda/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4278,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/immutable@\\1/dist/immutable.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/immutable@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4279,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/immutable@5.0.0/dist/immutable.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/immutable/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4280,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/immutable@\\1/dist/immutable.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/immutable@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4281,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/immutable@5.0.0/dist/immutable.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/immutable/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4282,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/immutable@\\1/dist/immutable.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4283,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/immutable@5.0.0/dist/immutable.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/immutable/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4284,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/mout@\\1/mout.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/mout@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4285,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/mout@1.3.0/mout.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/mout/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4286,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/mout@\\1/mout.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/mout@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4287,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/mout@1.3.0/mout.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/mout/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4288,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/date-fns@\\1/bundle.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/date-fns@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4289,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/date-fns@3.4.0/bundle.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/date-fns/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4290,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/date-fns@\\1/bundle.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/date-fns@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4291,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/date-fns@3.4.0/bundle.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/date-fns/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4292,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/timeago.js@\\1/dist/timeago.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/timeago.js@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4293,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/timeago.js@4.0.2/dist/timeago.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/timeago.js/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4294,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/timeago.js@\\1/dist/timeago.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/timeago.js@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4295,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/timeago.js@4.0.2/dist/timeago.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/timeago.js/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4296,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/spin.js@\\1/dist/spin.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/spin.js@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4297,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/spin.js@4.1.1/dist/spin.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/spin.js/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4298,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/spin.js@\\1/dist/spin.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/spin.js@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4299,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/spin.js@4.1.1/dist/spin.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/spin.js/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4300,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/spin.js@\\1/dist/spin.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4301,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/spin.js@4.1.1/dist/spin.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/spin.js/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4302,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/toastr/\\1/build/toastr.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/toastr@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4303,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/toastr/2.1.4/build/toastr.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/toastr/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4304,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/toastr/\\1/build/toastr.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/toastr@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4305,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/toastr/2.1.4/build/toastr.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/toastr/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4306,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/toastr/\\1/build/toastr.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4307,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/toastr/2.1.4/build/toastr.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/toastr.js/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4308,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution:
          'https://cdn.jsdelivr.net/npm/sweetalert2@\\1/dist/sweetalert2.all.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/sweetalert2@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4309,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/sweetalert2@11.10.6/dist/sweetalert2.all.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/sweetalert2/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4310,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution:
          'https://cdn.jsdelivr.net/npm/sweetalert2@\\1/dist/sweetalert2.all.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/sweetalert2@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4311,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/sweetalert2@11.10.6/dist/sweetalert2.all.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/sweetalert2/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4312,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution:
          'https://cdn.jsdelivr.net/npm/sweetalert2@\\1/dist/sweetalert2.all.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4313,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/sweetalert2@11.10.6/dist/sweetalert2.all.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/limonte-sweetalert2/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4314,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/notyf@\\1/notyf.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/notyf@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4315,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/notyf@3.10.0/notyf.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/notyf/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4316,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/notyf@\\1/notyf.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/notyf@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4317,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/notyf@3.10.0/notyf.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/notyf/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4318,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/notyf@\\1/notyf.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4319,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/notyf@3.10.0/notyf.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/notyf/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4320,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/pace-js@\\1/pace.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/pace-js@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4321,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/pace-js@1.2.4/pace.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/pace-js/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4322,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/pace-js@\\1/pace.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/pace-js@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4323,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/pace-js@1.2.4/pace.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/pace-js/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4324,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/pace-js@\\1/pace.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4325,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/pace-js@1.2.4/pace.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/pace/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4326,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/nprogress/\\1/nprogress.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/nprogress@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4327,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/nprogress/0.2.0/nprogress.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/nprogress/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4328,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/nprogress/\\1/nprogress.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/nprogress@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4329,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/nprogress/0.2.0/nprogress.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/nprogress/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4330,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/nprogress/\\1/nprogress.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4331,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/nprogress/0.2.0/nprogress.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/nprogress/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4332,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution:
          'https://cdn.jsdelivr.net/npm/isotope-layout@\\1/dist/isotope.pkgd.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/isotope-layout@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4333,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/isotope-layout@3.0.6/dist/isotope.pkgd.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/isotope-layout/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4334,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution:
          'https://cdn.jsdelivr.net/npm/isotope-layout@\\1/dist/isotope.pkgd.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/isotope-layout@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4335,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/isotope-layout@3.0.6/dist/isotope.pkgd.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/isotope-layout/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4336,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution:
          'https://cdn.jsdelivr.net/npm/isotope-layout@\\1/dist/isotope.pkgd.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4337,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/isotope-layout@3.0.6/dist/isotope.pkgd.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/jquery.isotope/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4338,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution:
          'https://cdn.jsdelivr.net/npm/masonry-layout@\\1/dist/masonry.pkgd.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/masonry-layout@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4339,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/masonry-layout@4.2.2/dist/masonry.pkgd.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/masonry-layout/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4340,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution:
          'https://cdn.jsdelivr.net/npm/masonry-layout@\\1/dist/masonry.pkgd.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/masonry-layout@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4341,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/masonry-layout@4.2.2/dist/masonry.pkgd.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/masonry-layout/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4342,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution:
          'https://cdn.jsdelivr.net/npm/masonry-layout@\\1/dist/masonry.pkgd.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4343,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/masonry-layout@4.2.2/dist/masonry.pkgd.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/masonry/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4344,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/imagesloaded@\\1/imagesloaded.pkgd.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/imagesloaded@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4345,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/imagesloaded@5.0.0/imagesloaded.pkgd.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/imagesloaded/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4346,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/imagesloaded@\\1/imagesloaded.pkgd.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/imagesloaded@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4347,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/imagesloaded@5.0.0/imagesloaded.pkgd.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/imagesloaded/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4348,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/imagesloaded@\\1/imagesloaded.pkgd.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4349,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/imagesloaded@5.0.0/imagesloaded.pkgd.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/jquery.imagesloaded/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4350,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/lazysizes@\\1/lazysizes.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/lazysizes@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4351,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/lazysizes@5.3.2/lazysizes.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/lazysizes/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4352,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/lazysizes@\\1/lazysizes.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/lazysizes@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4353,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/lazysizes@5.3.2/lazysizes.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/lazysizes/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4354,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/lazysizes@\\1/lazysizes.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4355,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/lazysizes@5.3.2/lazysizes.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/lazysizes/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4356,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/lozad@\\1/dist/lozad.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/lozad@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4357,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/lozad@1.16.0/dist/lozad.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/lozad/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4358,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/lozad@\\1/dist/lozad.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/lozad@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4359,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/lozad@1.16.0/dist/lozad.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/lozad/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4360,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/particles.js@\\1/particles.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/particles.js@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4361,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/particles.js@2.0.0/particles.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/particles.js/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4362,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/particles.js@\\1/particles.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/particles.js@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4363,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/particles.js@2.0.0/particles.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/particles.js/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4364,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/particles.js@\\1/particles.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4365,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/particles.js@2.0.0/particles.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/particles.js/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4366,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/typed.js@\\1/dist/typed.umd.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/typed.js@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4367,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/typed.js@2.1.0/dist/typed.umd.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/typed.js/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4368,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/typed.js@\\1/dist/typed.umd.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/typed.js@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4369,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/typed.js@2.1.0/dist/typed.umd.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/typed.js/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4370,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/typed.js@\\1/dist/typed.umd.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4371,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/typed.js@2.1.0/dist/typed.umd.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/typed.js/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4372,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/countup.js@\\1/dist/countUp.umd.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/countup.js@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4373,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/countup.js@2.8.0/dist/countUp.umd.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/countup.js/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4374,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/countup.js@\\1/dist/countUp.umd.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/countup.js@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4375,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/countup.js@2.8.0/dist/countUp.umd.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/countup.js/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4376,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/countup.js@\\1/dist/countUp.umd.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4377,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/countup.js@2.8.0/dist/countUp.umd.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/countup.js/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4378,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/aos@\\1/dist/aos.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/aos@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4379,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/aos@2.3.4/dist/aos.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/aos/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4380,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/aos@\\1/dist/aos.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/aos@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4381,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/aos@2.3.4/dist/aos.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/aos/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4382,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/aos@\\1/dist/aos.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4383,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/aos@2.3.4/dist/aos.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/aos/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4384,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/wow.js@\\1/dist/wow.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/wow.js@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4385,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/wow.js@1.2.2/dist/wow.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/wow.js/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4386,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/wow.js@\\1/dist/wow.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/wow.js@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4387,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/wow.js@1.2.2/dist/wow.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/wow.js/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4388,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/wow.js@\\1/dist/wow.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4389,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/wow.js@1.2.2/dist/wow.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/wow/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4390,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution:
          'https://cdn.jsdelivr.net/npm/scrollmagic@\\1/minified/ScrollMagic.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/scrollmagic@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4391,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/scrollmagic@2.0.8/minified/ScrollMagic.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/scrollmagic/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4392,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution:
          'https://cdn.jsdelivr.net/npm/scrollmagic@\\1/minified/ScrollMagic.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/scrollmagic@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4393,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/scrollmagic@2.0.8/minified/ScrollMagic.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/scrollmagic/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4394,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution:
          'https://cdn.jsdelivr.net/npm/scrollmagic@\\1/minified/ScrollMagic.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4395,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/scrollmagic@2.0.8/minified/ScrollMagic.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/ScrollMagic/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4396,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/scrollto@\\1/dist scrollTo.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/scrollto@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4397,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/scrollto@3.0.0/dist scrollTo.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/scrollto/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4398,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/scrollto@\\1/dist scrollTo.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/scrollto@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4399,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/scrollto@3.0.0/dist scrollTo.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/scrollto/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4400,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution:
          'https://cdn.jsdelivr.net/npm/smoothscroll-polyfill@\\1/dist/smoothscroll.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/smoothscroll-polyfill@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4401,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/smoothscroll-polyfill@0.4.4/dist/smoothscroll.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/smoothscroll-polyfill/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4402,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution:
          'https://cdn.jsdelivr.net/npm/smoothscroll-polyfill@\\1/dist/smoothscroll.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/smoothscroll-polyfill@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4403,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/smoothscroll-polyfill@0.4.4/dist/smoothscroll.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/smoothscroll-polyfill/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4404,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/layzr.js@\\1/dist/layzr.module.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/layzr.js@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4405,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/layzr.js@2.2.2/dist/layzr.module.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/layzr.js/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4406,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/layzr.js@\\1/dist/layzr.module.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/layzr.js@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4407,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/layzr.js@2.2.2/dist/layzr.module.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/layzr.js/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4408,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/medium-zoom@\\1/dist/medium-zoom.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/medium-zoom@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4409,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/medium-zoom@1.1.0/dist/medium-zoom.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/medium-zoom/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4410,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/medium-zoom@\\1/dist/medium-zoom.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/medium-zoom@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4411,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/medium-zoom@1.1.0/dist/medium-zoom.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/medium-zoom/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4412,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/spotlight.js@\\1/dist/spotlight.bundle.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/spotlight.js@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4413,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/spotlight.js@0.7.8/dist/spotlight.bundle.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/spotlight.js/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4414,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/spotlight.js@\\1/dist/spotlight.bundle.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/spotlight.js@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4415,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/spotlight.js@0.7.8/dist/spotlight.bundle.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/spotlight.js/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4416,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/glightbox@\\1/dist/js/glightbox.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/glightbox@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4417,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/glightbox@3.2.0/dist/js/glightbox.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/glightbox/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4418,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.jsdelivr.net/npm/glightbox@\\1/dist/js/glightbox.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/glightbox@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4419,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/glightbox@3.2.0/dist/js/glightbox.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/glightbox/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4420,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution:
          'https://cdn.jsdelivr.net/npm/@fancyapps/ui@\\1/dist/fancybox/fancybox.umd.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/@fancyapps\\/ui@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4421,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/@fancyapps/ui@5.0.36/dist/fancybox/fancybox.umd.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/@fancyapps/ui/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4422,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution:
          'https://cdn.jsdelivr.net/npm/@fancyapps/ui@\\1/dist/fancybox/fancybox.umd.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/@fancyapps\\/ui@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4423,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/@fancyapps/ui@5.0.36/dist/fancybox/fancybox.umd.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/@fancyapps/ui/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4424,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution:
          'https://cdn.jsdelivr.net/npm/@fancyapps/ui@\\1/dist/fancybox/fancybox.umd.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4425,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/@fancyapps/ui@5.0.36/dist/fancybox/fancybox.umd.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/fancybox/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4426,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution:
          'https://cdn.jsdelivr.net/npm/photoswipe@\\1/dist/umd/photoswipe.umd.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/photoswipe@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4427,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/photoswipe@5.4.3/dist/umd/photoswipe.umd.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/photoswipe/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4428,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution:
          'https://cdn.jsdelivr.net/npm/photoswipe@\\1/dist/umd/photoswipe.umd.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/photoswipe@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4429,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/photoswipe@5.4.3/dist/umd/photoswipe.umd.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/photoswipe/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4430,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution:
          'https://cdn.jsdelivr.net/npm/photoswipe@\\1/dist/umd/photoswipe.umd.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4431,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.jsdelivr.net/npm/photoswipe@5.4.3/dist/umd/photoswipe.umd.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdnjs.cloudflare.com/ajax/libs/photoswipe/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4432,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/swiper/\\1/swiper-bundle.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://cdn\\.jsdelivr\\.net/npm/swiper@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4433,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/swiper/11.0.5/swiper-bundle.min.js',
      },
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/swiper@11/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4434,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: 'https://cdn.staticfile.org/swiper/\\1/swiper-bundle.min.js',
      },
    },
    condition: {
      regexFilter: '^https?://unpkg\\.com/swiper@([\\d.]+)/.*\\.js$',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
  {
    id: 4435,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.staticfile.org/swiper/11.0.5/swiper-bundle.min.js',
      },
    },
    condition: {
      urlFilter: '*://unpkg.com/swiper@11/*',
      resourceTypes: ['script'],
      excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
    },
  },
]

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AUTO_GENERATED_JS_REDIRECT_RULES }
}
