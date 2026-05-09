/**
 * 自动生成的DNR JS重定向规则
 * 生成时间: 2026-05-09T23:11:52.198Z
 * 规则数量: 218
 * 规则ID范围: 4001-4218
 */

// 使用 var 允许 Service Worker 多次 importScripts
var AUTO_GENERATED_JS_REDIRECT_RULES = [
  {
    id: 4001,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/jquery/3.7.1/jquery.min.js"
    }
},
    condition: {
    "urlFilter": "*://code.jquery.com/jquery-*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4002,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/jquery/3.7.1/jquery.min.js"
    }
},
    condition: {
    "urlFilter": "*://ajax.googleapis.com/ajax/libs/jquery/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4003,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/jquery/3.7.1/jquery.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/jquery/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4004,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/jquery/3.7.1/jquery.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/jquery/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4005,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/jquery/3.7.1/jquery.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/jquery/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4006,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/react/18.2.0/umd/react.production.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/react/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4007,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/react/18.2.0/umd/react.production.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/react/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4008,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/react/18.2.0/umd/react.production.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/react/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4009,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/react-dom/18.2.0/umd/react-dom.production.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/react-dom/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4010,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/react-dom/18.2.0/umd/react-dom.production.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/react-dom/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4011,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/react-dom/18.2.0/umd/react-dom.production.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/react-dom/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4012,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/vue/3.4.21/dist/vue.global.prod.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/vue/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4013,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/vue/3.4.21/dist/vue.global.prod.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/vue/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4014,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/vue/3.4.21/dist/vue.global.prod.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/vue/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4015,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/lodash/4.17.21/lodash.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/lodash/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4016,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/lodash/4.17.21/lodash.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/lodash/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4017,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/lodash/4.17.21/lodash.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/lodash.js/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4018,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/axios/1.6.7/dist/axios.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/axios/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4019,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/axios/1.6.7/dist/axios.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/axios/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4020,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/axios/1.6.7/dist/axios.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/axios/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4021,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/moment/2.30.1/min/moment.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/moment/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4022,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/moment/2.30.1/min/moment.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/moment/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4023,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/moment/2.30.1/min/moment.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/moment.js/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4024,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/echarts/5.5.0/dist/echarts.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/echarts/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4025,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/echarts/5.5.0/dist/echarts.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/echarts/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4026,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/echarts/5.5.0/dist/echarts.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/echarts/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4027,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/d3/7.8.5/dist/d3.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/d3/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4028,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/d3/7.8.5/dist/d3.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/d3/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4029,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/d3/7.8.5/dist/d3.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/d3/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4030,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/chart.js/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4031,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/chart.js/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4032,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/Chart.js/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4033,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/three/0.168.0/build/three.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/three/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4034,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/three/0.168.0/build/three.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/three/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4035,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/three/0.168.0/build/three.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/three.js/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4036,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/dayjs/1.11.10/dayjs.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/dayjs/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4037,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/dayjs/1.11.10/dayjs.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/dayjs/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4038,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/dayjs/1.11.10/dayjs.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/dayjs/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4039,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/animejs@3.2.2/lib/anime.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/animejs/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4040,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/animejs@3.2.2/lib/anime.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/animejs/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4041,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/animejs@3.2.2/lib/anime.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/animejs/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4042,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/hammerjs/2.0.8/hammer.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/hammerjs/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4043,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/hammerjs/2.0.8/hammer.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/hammerjs/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4044,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/hammerjs/2.0.8/hammer.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/hammer.js/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4045,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/jquery-ui/1.13.2/dist/jquery-ui.min.js"
    }
},
    condition: {
    "urlFilter": "*://code.jquery.com/ui/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4046,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/jquery-ui/1.13.2/dist/jquery-ui.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/jquery-ui/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4047,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/jquery-ui/1.13.2/dist/jquery-ui.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/jqueryui/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4048,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/bootstrap/5.3.3/dist/js/bootstrap.min.js"
    }
},
    condition: {
    "urlFilter": "*://stackpath.bootstrapcdn.com/bootstrap/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4049,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/bootstrap/5.3.3/dist/js/bootstrap.min.js"
    }
},
    condition: {
    "urlFilter": "*://maxcdn.bootstrapcdn.com/bootstrap/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4050,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/bootstrap/5.3.3/dist/js/bootstrap.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/bootstrap/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4051,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/bootstrap/5.3.3/dist/js/bootstrap.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/bootstrap/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4052,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/@popperjs/core/2.11.8/dist/umd/popper.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/@popperjs/core/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4053,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/@popperjs/core/2.11.8/dist/umd/popper.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/@popperjs/core/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4054,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/@popperjs/core/2.11.8/dist/umd/popper.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/popper.js/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4055,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/swiper/11.0.5/swiper-bundle.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/swiper/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4056,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/swiper/11.0.5/swiper-bundle.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/swiper/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4057,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/swiper/11.0.5/swiper-bundle.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/Swiper/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4058,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/select2/4.0.13/dist/js/select2.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/select2/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4059,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/select2/4.0.13/dist/js/select2.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/select2/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4060,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/select2/4.0.13/dist/js/select2.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/select2/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4061,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/gsap/3.12.5/dist/gsap.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/gsap/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4062,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/gsap/3.12.5/dist/gsap.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/gsap/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4063,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/gsap/3.12.5/dist/gsap.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/gsap/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4064,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/@fortawesome/fontawesome-free/6.5.1/js/all.min.js"
    }
},
    condition: {
    "urlFilter": "*://use.fontawesome.com/releases/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4065,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/@fortawesome/fontawesome-free/6.5.1/js/all.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4066,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/@fortawesome/fontawesome-free/6.5.1/js/all.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/font-awesome/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4067,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/tailwindcss@3.4.1/lib/index.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.tailwindcss.com/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4068,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/tailwindcss@3.4.1/lib/index.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/tailwindcss/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4069,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/alpinejs@3.13.5/dist/cdn.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/alpinejs/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4070,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/alpinejs@3.13.5/dist/cdn.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/alpinejs/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4071,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/htmx.org@1.9.10/dist/htmx.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/htmx.org/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4072,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/htmx.org@1.9.10/dist/htmx.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/htmx.org/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4073,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/underscore/1.13.6/underscore-umd-min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/underscore/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4074,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/underscore/1.13.6/underscore-umd-min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/underscore/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4075,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/underscore/1.13.6/underscore-umd-min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/underscore.js/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4076,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/backbone/1.5.0/backbone-min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/backbone/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4077,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/backbone/1.5.0/backbone-min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/backbone/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4078,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/backbone/1.5.0/backbone-min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/backbone.js/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4079,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/@angular/core@17.2.4/bundles/core.umd.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/@angular/core/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4080,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/@angular/core@17.2.4/bundles/core.umd.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/@angular/core/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4081,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/@angular/core@17.2.4/bundles/core.umd.min.js"
    }
},
    condition: {
    "urlFilter": "*://ajax.googleapis.com/ajax/libs/angularjs/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4082,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/svelte@4.2.12/internal/index.mjs"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/svelte/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4083,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/svelte@4.2.12/internal/index.mjs"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/svelte/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4084,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/socket.io-client@4.7.5/dist/socket.io.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/socket.io-client/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4085,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/socket.io-client@4.7.5/dist/socket.io.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/socket.io-client/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4086,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/socket.io-client@4.7.5/dist/socket.io.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/socket.io/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4087,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/pdfjs-dist/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4088,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/pdfjs-dist/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4089,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/pdf.js/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4090,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/video.js/8.10.0/dist/video.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/video.js/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4091,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/video.js/8.10.0/dist/video.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/video.js/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4092,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/video.js/8.10.0/dist/video.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/video.js/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4093,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/video.js/8.10.0/dist/video.min.js"
    }
},
    condition: {
    "urlFilter": "*://vjs.zencdn.net/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4094,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/howler@2.2.4/dist/howler.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/howler/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4095,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/howler@2.2.4/dist/howler.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/howler/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4096,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/howler@2.2.4/dist/howler.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/howler/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4097,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/numeral/2.0.6/min/numeral.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/numeral/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4098,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/numeral/2.0.6/min/numeral.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/numeral/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4099,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/numeral/2.0.6/min/numeral.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/numeral.js/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4100,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/accounting/0.4.2/accounting.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/accounting/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4101,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/accounting/0.4.2/accounting.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/accounting/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4102,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/accounting/0.4.2/accounting.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/accounting.js/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4103,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/marked@12.0.1/marked.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/marked/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4104,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/marked@12.0.1/marked.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/marked/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4105,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/marked@12.0.1/marked.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/marked/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4106,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/highlight.js/11.9.0/highlight.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/gh/highlightjs/cdn-release/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4107,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/highlight.js/11.9.0/highlight.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/highlight.js/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4108,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/prismjs/1.29.0/prism.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/prismjs/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4109,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/prismjs/1.29.0/prism.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/prismjs/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4110,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/prismjs/1.29.0/prism.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/prism/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4111,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/validator@13.11.0/validator.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/validator/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4112,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/validator@13.11.0/validator.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/validator/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4113,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/uuid@9.0.1/dist/umd/uuid.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/uuid/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4114,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/uuid@9.0.1/dist/umd/uuid.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/uuid/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4115,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/uuid@9.0.1/dist/umd/uuid.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/uuid/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4116,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/crypto-js/4.2.0/crypto-js.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/crypto-js/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4117,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/crypto-js/4.2.0/crypto-js.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/crypto-js/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4118,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/crypto-js/4.2.0/crypto-js.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/crypto-js/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4119,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/js-cookie@3.0.5/dist/js.cookie.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/js-cookie/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4120,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/js-cookie@3.0.5/dist/js.cookie.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/js-cookie/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4121,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/js-cookie@3.0.5/dist/js.cookie.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/js-cookie/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4122,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/store@2.0.12/dist/store.legacy.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/store/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4123,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/store@2.0.12/dist/store.legacy.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/store/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4124,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/store@2.0.12/dist/store.legacy.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/store.js/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4125,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/localforage@1.10.0/dist/localforage.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/localforage/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4126,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/localforage@1.10.0/dist/localforage.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/localforage/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4127,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/localforage@1.10.0/dist/localforage.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/localforage/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4128,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/pako/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4129,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/pako/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4130,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/pako/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4131,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/lz-string@1.5.0/libs/lz-string.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/lz-string/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4132,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/lz-string@1.5.0/libs/lz-string.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/lz-string/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4133,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/lz-string@1.5.0/libs/lz-string.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/lz-string/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4134,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/mathjs@12.4.1/lib/browser/math.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/mathjs/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4135,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/mathjs@12.4.1/lib/browser/math.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/mathjs/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4136,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/mathjs@12.4.1/lib/browser/math.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/mathjs/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4137,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/ramda/0.29.1/dist/ramda.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/ramda/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4138,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/ramda/0.29.1/dist/ramda.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/ramda/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4139,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/ramda/0.29.1/dist/ramda.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/ramda/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4140,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/immutable@5.0.0/dist/immutable.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/immutable/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4141,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/immutable@5.0.0/dist/immutable.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/immutable/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4142,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/immutable@5.0.0/dist/immutable.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/immutable/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4143,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/mout@1.3.0/mout.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/mout/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4144,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/mout@1.3.0/mout.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/mout/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4145,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/date-fns@3.4.0/bundle.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/date-fns/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4146,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/date-fns@3.4.0/bundle.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/date-fns/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4147,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/timeago.js@4.0.2/dist/timeago.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/timeago.js/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4148,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/timeago.js@4.0.2/dist/timeago.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/timeago.js/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4149,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/spin.js@4.1.1/dist/spin.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/spin.js/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4150,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/spin.js@4.1.1/dist/spin.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/spin.js/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4151,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/spin.js@4.1.1/dist/spin.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/spin.js/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4152,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/toastr/2.1.4/build/toastr.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/toastr/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4153,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/toastr/2.1.4/build/toastr.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/toastr/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4154,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/toastr/2.1.4/build/toastr.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/toastr.js/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4155,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/sweetalert2@11.10.6/dist/sweetalert2.all.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/sweetalert2/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4156,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/sweetalert2@11.10.6/dist/sweetalert2.all.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/sweetalert2/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4157,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/sweetalert2@11.10.6/dist/sweetalert2.all.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/limonte-sweetalert2/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4158,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/notyf@3.10.0/notyf.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/notyf/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4159,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/notyf@3.10.0/notyf.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/notyf/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4160,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/notyf@3.10.0/notyf.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/notyf/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4161,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/pace-js@1.2.4/pace.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/pace-js/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4162,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/pace-js@1.2.4/pace.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/pace-js/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4163,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/pace-js@1.2.4/pace.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/pace/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4164,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/nprogress/0.2.0/nprogress.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/nprogress/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4165,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/nprogress/0.2.0/nprogress.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/nprogress/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4166,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/nprogress/0.2.0/nprogress.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/nprogress/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4167,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/isotope-layout@3.0.6/dist/isotope.pkgd.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/isotope-layout/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4168,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/isotope-layout@3.0.6/dist/isotope.pkgd.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/isotope-layout/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4169,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/isotope-layout@3.0.6/dist/isotope.pkgd.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/jquery.isotope/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4170,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/masonry-layout@4.2.2/dist/masonry.pkgd.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/masonry-layout/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4171,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/masonry-layout@4.2.2/dist/masonry.pkgd.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/masonry-layout/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4172,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/masonry-layout@4.2.2/dist/masonry.pkgd.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/masonry/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4173,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/imagesloaded@5.0.0/imagesloaded.pkgd.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/imagesloaded/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4174,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/imagesloaded@5.0.0/imagesloaded.pkgd.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/imagesloaded/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4175,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/imagesloaded@5.0.0/imagesloaded.pkgd.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/jquery.imagesloaded/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4176,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/lazysizes@5.3.2/lazysizes.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/lazysizes/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4177,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/lazysizes@5.3.2/lazysizes.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/lazysizes/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4178,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/lazysizes@5.3.2/lazysizes.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/lazysizes/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4179,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/lozad@1.16.0/dist/lozad.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/lozad/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4180,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/lozad@1.16.0/dist/lozad.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/lozad/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4181,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/particles.js@2.0.0/particles.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/particles.js/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4182,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/particles.js@2.0.0/particles.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/particles.js/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4183,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/particles.js@2.0.0/particles.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/particles.js/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4184,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/typed.js@2.1.0/dist/typed.umd.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/typed.js/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4185,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/typed.js@2.1.0/dist/typed.umd.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/typed.js/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4186,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/typed.js@2.1.0/dist/typed.umd.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/typed.js/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4187,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/countup.js@2.8.0/dist/countUp.umd.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/countup.js/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4188,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/countup.js@2.8.0/dist/countUp.umd.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/countup.js/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4189,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/countup.js@2.8.0/dist/countUp.umd.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/countup.js/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4190,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/aos@2.3.4/dist/aos.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/aos/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4191,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/aos@2.3.4/dist/aos.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/aos/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4192,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/aos@2.3.4/dist/aos.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/aos/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4193,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/wow.js@1.2.2/dist/wow.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/wow.js/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4194,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/wow.js@1.2.2/dist/wow.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/wow.js/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4195,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/wow.js@1.2.2/dist/wow.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/wow/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4196,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/scrollmagic@2.0.8/minified/ScrollMagic.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/scrollmagic/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4197,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/scrollmagic@2.0.8/minified/ScrollMagic.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/scrollmagic/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4198,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/scrollmagic@2.0.8/minified/ScrollMagic.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/ScrollMagic/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4199,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/scrollto@3.0.0/dist scrollTo.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/scrollto/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4200,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/scrollto@3.0.0/dist scrollTo.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/scrollto/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4201,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/smoothscroll-polyfill@0.4.4/dist/smoothscroll.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/smoothscroll-polyfill/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4202,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/smoothscroll-polyfill@0.4.4/dist/smoothscroll.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/smoothscroll-polyfill/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4203,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/layzr.js@2.2.2/dist/layzr.module.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/layzr.js/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4204,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/layzr.js@2.2.2/dist/layzr.module.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/layzr.js/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4205,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/medium-zoom@1.1.0/dist/medium-zoom.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/medium-zoom/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4206,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/medium-zoom@1.1.0/dist/medium-zoom.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/medium-zoom/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4207,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/spotlight.js@0.7.8/dist/spotlight.bundle.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/spotlight.js/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4208,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/spotlight.js@0.7.8/dist/spotlight.bundle.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/spotlight.js/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4209,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/glightbox@3.2.0/dist/js/glightbox.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/glightbox/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4210,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/glightbox@3.2.0/dist/js/glightbox.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/glightbox/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4211,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/@fancyapps/ui@5.0.36/dist/fancybox/fancybox.umd.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/@fancyapps/ui/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4212,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/@fancyapps/ui@5.0.36/dist/fancybox/fancybox.umd.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/@fancyapps/ui/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4213,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/@fancyapps/ui@5.0.36/dist/fancybox/fancybox.umd.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/fancybox/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4214,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/photoswipe@5.4.3/dist/umd/photoswipe.umd.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/photoswipe/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4215,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/photoswipe@5.4.3/dist/umd/photoswipe.umd.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/photoswipe/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4216,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.jsdelivr.net/npm/photoswipe@5.4.3/dist/umd/photoswipe.umd.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdnjs.cloudflare.com/ajax/libs/photoswipe/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4217,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/swiper/11.0.5/swiper-bundle.min.js"
    }
},
    condition: {
    "urlFilter": "*://cdn.jsdelivr.net/npm/swiper@11/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  },
  {
    id: 4218,
    priority: 1,
    action: {
    "type": "redirect",
    "redirect": {
        "url": "https://cdn.staticfile.org/swiper/11.0.5/swiper-bundle.min.js"
    }
},
    condition: {
    "urlFilter": "*://unpkg.com/swiper@11/*",
    "resourceTypes": [
        "script"
    ],
    "excludedInitiatorDomains": [
        "cdn.bootcdn.net",
        "cdn.staticfile.org"
    ]
}
  }
]

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AUTO_GENERATED_JS_REDIRECT_RULES }
}
