var config = {
    environment: process.env.CARTO_WINDSHAFT_NODE_ENV,
    port: 8181,
    host: null, // null on purpouse so it listens to whatever address docker assigns
    // Size of the threadpool which can be used to run user code and get notified in the loop thread
    // Its default size is 4, but it can be changed at startup time (the absolute maximum is 128).
    // See http://docs.libuv.org/en/latest/threadpool.html
    uv_threadpool_size: undefined,
    // Time in milliseconds to force GC cycle.
    // Disable by using <=0 value.
    gc_interval: 10000,
    // Regular expression pattern to extract username
    // from hostname. Must have a single grabbing block.
    user_from_host: process.env.CARTO_WINDSHAFT_USER_FROM_HOST || '^(.*)\\.cartodb\\.com$',

    // Base URLs for the APIs
    //
    // See https://github.com/CartoDB/Windshaft-cartodb/wiki/Unified-Map-API
    //
    // Note: each entry corresponds with an express' router.
    // You must define at least one path. However, middlewares are optional.
    routes: {
        api: [{
            paths: [
                '/api/v1',
                '/user/:user/api/v1'
            ],
            // This must be a **comma-separated string** with the list of paths to the middlewares. Pe:
            //     CARTO_WINDSHAFT_PREROUTING_MIDDLEWARES=/usr/src/lib/mw1.js,/usr/src/lib/mw2.js
            // Note: The list order is kept when loading the middlewares!
            middlewares: process.env.CARTO_WINDSHAFT_PREROUTING_MIDDLEWARES || '',
            // Base url for the Detached Maps API
            // "/api/v1/map" is the new API,
            map: [{
                paths: [
                    '/map'
                ],
                middlewares: process.env.CARTO_WINDSHAFT_MAPROUTING_MIDDLEWARES || ''
            }],
            // Base url for the Templated Maps API
            // "/api/v1/map/named" is the new API,
            template: [{
                paths: [
                    '/map/named'
                ],
                middlewares: process.env.CARTO_WINDSHAFT_NAMEDMAPROUTING_MIDDLEWARES || ''
            }]
        }]
    },

    // Resource URLs expose endpoints to request/retrieve metadata associated to Maps: dataviews, analysis node status.
    //
    // This URLs depend on how `routes` and `user_from_host` are configured: the application can be
    // configured to accept request with the {user} in the header host or in the request path.
    // It also might depend on the configured cdn_url via `serverMetadata.cdn_url`.
    //
    // This template allows to make the endpoints generation more flexible, the template exposes the following params:
    //  1. {{=it.cdn_url}}: will be used when `serverMetadata.cdn_url` exists.
    //  2. {{=it.user}}: will use the username as extraced from `user_from_host` or `routes`.
    //  3. {{=it.port}}: will use the `port` from this very same configuration file.
    resources_url_templates: {
        http: process.env.CARTO_WINDSHAFT_RESOURCE_URL_TEMPLATE_HTTP || 'http://{{=it.cdn_url}}/{{=it.user}}/api/v1/map',
        https: process.env.CARTO_WINDSHAFT_RESOURCE_URL_TEMPLATE_HTTPS || 'https://{{=it.cdn_url}}/{{=it.user}}/api/v1/map'
    },
    // Specify the maximum length of the queue of pending connections for the HTTP server.
    // The actual length will be determined by the OS through sysctl settings such as tcp_max_syn_backlog and somaxconn on Linux.
    // The default value of this parameter is 511 (not 512).
    // See: https://nodejs.org/docs/latest/api/net.html#net_server_listen
    maxConnections: 128,
    // Maximum number of templates per user. Unlimited by default.
    maxUserTemplates: 1024,
    // Seconds since "last creation" before a detached
    // or template instance map expires. Or: how long do you want
    // to be able to navigate the map without a reload ?
    // Defaults to 7200 (2 hours)
    mapConfigTTL: 7200,
    // idle socket timeout, in milliseconds
    socket_timeout: 600000,
    enable_cors: true,
    cache_enabled: true,
    // Templated database username for authorized user
    // Supported labels: 'user_id' (read from redis)
    postgres_auth_user: process.env.CARTO_WINDSHAFT_DB_USER || 'cartodb_user_<%= user_id %>',
    // Templated database password for authorized user
    // Supported labels: 'user_id', 'user_password' (both read from redis)
    postgres_auth_pass: '<%= user_password %>',
    postgres: {
        user: 'publicuser',
        password: 'public',
        host: process.env.CARTO_WINDSHAFT_POSTGRES_HOST || 'localhost',
        port: process.env.CARTO_WINDSHAFT_POSTGRES_PORT || 5432,
        pool: {
            // maximum number of resources to create at any given time
            size: 16,
            // max milliseconds a resource can go unused before it should be destroyed
            idleTimeout: 3000,
            // frequency to check for idle resources
            reapInterval: 1000
        }
    },
    mapnik_version: undefined,
    mapnik_tile_format: 'png8:m=h',
    statsd: {
        host: process.env.CARTO_WINDSHAFT_STATSD_HOST || 'localhost',
        port: 8125,
        prefix: process.env.CARTO_WINDSHAFT_STATSD_PREFIX || ':host.', // could be hostname, better not containing dots
        cacheDns: true
        // support all allowed node-statsd options
    },
    renderer: {
        // Milliseconds since last access before renderer cache item expires
        cache_ttl: 60000,
        statsInterval: 5000, // milliseconds between each report to statsd about number of renderers and mapnik pool status
        mvt: {
        // If enabled, MVTs will be generated with PostGIS directly
        // If disabled, MVTs will be generated with Mapnik MVT
            usePostGIS: true
        },
        mapnik: {
            // The size of the pool of internal mapnik backend
            // This pool size is per mapnik renderer created in Windshaft's RendererFactory
            // See https://github.com/CartoDB/Windshaft/blob/master/lib/windshaft/renderers/renderer_factory.js
            // Important: check the configuration of uv_threadpool_size to use suitable value
            poolSize: 8,

            // The maximum number of waiting clients of the pool of internal mapnik backend
            // This maximum number is per mapnik renderer created in Windshaft's RendererFactory
            poolMaxWaitingClients: 64,

            // Whether grainstore will use a child process or not to transform CartoCSS into Mapnik XML.
            // This will prevent blocking the main thread.
            useCartocssWorkers: false,

            // Metatile is the number of tiles-per-side that are going
            // to be rendered at once. If all of them will be requested
            // we'd have saved time. If only one will be used, we'd have
            // wasted time.
            metatile: 2,

            // tilelive-mapnik uses an internal cache to store tiles/grids
            // generated when using metatile. This options allow to tune
            // the behaviour for that internal cache.
            metatileCache: {
                // Time an object must stay in the cache until is removed
                ttl: 0,
                // Whether an object must be removed after the first hit
                // Usually you want to use `true` here when ttl>0.
                deleteOnHit: false
            },

            // Override metatile behaviour depending on the format
            formatMetatile: {
                png: 2,
                'grid.json': 1
            },

            // Buffer size is the tickness in pixel of a buffer
            // around the rendered (meta?)tile.
            //
            // This is important for labels and other marker that overlap tile boundaries.
            // Setting to 128 ensures no render artifacts.
            // 64 may have artifacts but is faster.
            // Less important if we can turn metatiling on.
            bufferSize: 64,

            // SQL queries will be wrapped with ST_SnapToGrid
            // Snapping all points of the  geometry to a regular grid
            snapToGrid: false,

            // SQL queries will be wrapped with ST_ClipByBox2D
            // Returning the portion of a geometry falling within a rectangle
            // It will only work if snapToGrid is enabled
            clipByBox2d: true,

            postgis: {
                // Parameters to pass to datasource plugin of mapnik
                // See http://github.com/mapnik/mapnik/wiki/PostGIS
                user: 'publicuser',
                password: 'public',
                host: process.env.CARTO_WINDSHAFT_POSTGRES_HOST || '127.0.0.1',
                port: process.env.CARTO_WINDSHAFT_POSTGRES_PORT || 5432,
                extent: '-20037508.3,-20037508.3,20037508.3,20037508.3',
                // max number of rows to return when querying data, 0 means no limit
                row_limit: 65535,
                /*
               * Set persist_connection to false if you want
               * database connections to be closed on renderer
               * expiration (1 minute after last use).
               * Setting to true (the default) would never
               * close any connection for the server's lifetime
               */
                persist_connection: false,
                simplify_geometries: true,
                use_overviews: true, // use overviews to retrieve raster
                max_size: 500,
                twkb_encoding: true
            },

            limits: {
                // Time in milliseconds a render request can take before it fails, some notes:
                //  - 0 means no render limit
                //  - it considers metatiling, naive implementation: (render timeout) * (number of tiles in metatile)
                render: 0,
                // As the render request will finish even if timed out, whether it should be placed in the internal
                // cache or it should be fully discarded. When placed in the internal cache another attempt to retrieve
                // the same tile will result in an immediate response, however that will use a lot of more application
                // memory. If we want to enforce this behaviour we have to implement a cache eviction policy for the
                // internal cache.
                cacheOnTimeout: true
            },

            // If enabled Mapnik will reuse the features retrieved from the database
            // instead of requesting them once per style inside a layer
            'cache-features': true,

            // Require metrics to the renderer
            metrics: false,

            // Options for markers attributes, ellipses and images caches
            markers_symbolizer_caches: {
                disabled: false
            }
        },
        http: {
            timeout: 2000, // the timeout in ms for a http tile request
            proxy: undefined, // the url for a proxy server
            whitelist: [ // the whitelist of urlTemplates that can be used
                '.*', // will enable any URL
                'http://{s}.example.com/{z}/{x}/{y}.png'
            ],
            // image to use as placeholder when urlTemplate is not in the whitelist
            // if provided the http renderer will use it instead of throw an error
            fallbackImage: {
                type: 'fs', // 'fs' and 'url' supported
                src: __dirname + '/../../assets/default-placeholder.png'
            }
        },
        torque: {}
    },
    // anything analyses related
    analysis: {
        // batch configuration
        batch: {
            // Inline execution avoid the use of SQL API as batch endpoint
            // When set to true it will run all analysis queries in series, with a direct connection to the DB
            // This might be useful for:
            //  - testing
            //  - running an standalone server without any dependency on external services
            inlineExecution: false,
            // where the SQL API is running, it will use a custom Host header to specify the username.
            endpoint: 'http://' + process.env.CARTO_WINDSHAFT_ANALYSIS_HOST + ':' + process.env.CARTO_WINDSHAFT_ANALYSIS_PORT + '/api/v2/sql/job',
            // the template to use for adding the host header in the batch api requests
            hostHeaderTemplate: '{{=it.username}}.localhost.lan'
        },
        // Define max execution time in ms for analyses or tags
        // If analysis or tag are not found in redis this values will be used as default.
        limits: {
            moran: { timeout: 120000, maxNumberOfRows: 1e5 },
            cpu2x: { timeout: 60000 }
        }
    },
    millstone: {
        // Needs to be writable by server user
        cache_basedir: process.env.CARTO_WINDSHAFT_TILE_CACHE || '/home/ubuntu/tile_assets/'
    },
    redis: {
        host: process.env.CARTO_WINDSHAFT_REDIS_HOST || '127.0.0.1',
        port: process.env.CARTO_WINDSHAFT_REDIS_PORT || 6379,
        // Max number of connections in each pool.
        // Users will be put on a queue when the limit is hit.
        // Set to maxConnection to have no possible queues.
        // There are currently 2 pools involved in serving
        // windshaft-cartodb requests so multiply this number
        // by 2 to know how many possible connections will be
        // kept open by the servelsr. The default is 50.
        max: 50,
        returnToHead: true, // defines the behaviour of the pool: false => queue, true => stack
        idleTimeoutMillis: 30000, // idle time before dropping connection
        reapIntervalMillis: 1000, // time between cleanups
        slowQueries: {
            log: true,
            elapsedThreshold: 200
        },
        slowPool: {
            log: true, // whether a slow acquire must be logged or not
            elapsedThreshold: 25 // the threshold to determine an slow acquire must be reported or not
        },
        emitter: {
            statusInterval: 5000 // time, in ms, between each status report is emitted from the pool, status is sent to statsd
        },
        unwatchOnRelease: false, // Send unwatch on release, see http://github.com/CartoDB/Windshaft-cartodb/issues/161
        noReadyCheck: true // Check `no_ready_check` at https://github.com/mranney/node_redis/tree/v0.12.1#overloading
    },
    // For more details about this options check https://nodejs.org/api/http.html#http_new_agent_options
    httpAgent: {
        keepAlive: true,
        keepAliveMsecs: 1000,
        maxSockets: 25,
        maxFreeSockets: 256
    },
    varnish: {
        host: process.env.CARTO_WINDSHAFT_VARNISH_PORT || 'localhost',
        port: process.env.CARTO_WINDSHAFT_VARNISH_PORT || 6082, // the por for the telnet interface where varnish is listening to
        http_port: 6081, // the port for the HTTP interface where varnish is listening to
        purge_enabled: process.env.CARTO_WINDSHAFT_VARNISH_PURGE_ENABLED === 'true' || false, // whether the purge/invalidation mechanism is enabled in varnish or not
        secret: 'xxx',
        ttl: 86400,
        fallbackTtl: 300,
        layergroupTtl: 86400 // the max-age for cache-control header in layergroup responses
    },
    // this [OPTIONAL] configuration enables invalidating by surrogate key in fastly
    fastly: {
        // whether the invalidation is enabled or not
        enabled: false,
        // the fastly api key
        apiKey: 'wadus_api_key',
        // the service that will get surrogate key invalidation
        serviceId: 'wadus_service_id'
    },
    useProfiler: true,
    serverMetadata: {
        cdn_url: {
            http: process.env.CARTO_WINDSHAFT_SERVER_CDN_URL_HTTP === 'undefined' ? undefined : process.env.CARTO_WINDSHAFT_SERVER_CDN_URL_HTTP || 'api.cartocdn.com',
            https: process.env.CARTO_WINDSHAFT_SERVER_CDN_URL_HTTPS === 'undefined' ? undefined : process.env.CARTO_WINDSHAFT_SERVER_CDN_URL_HTTPS || 'cartocdn.global.ssl.fastly.net'
        }
    },
    // Settings for the health check available at /health
    health: {
        enabled: process.env.CARTO_WINDSHAFT_HEALTH_ENABLED === 'true' || false,
        username: 'localhost',
        z: 0,
        x: 0,
        y: 0
    },
    disabled_file: 'pids/disabled',

    // Use this as a feature flags enabling/disabling mechanism
    enabledFeatures: {
        // whether it should intercept tile render errors an act based on them, enabled by default.
        onTileErrorStrategy: false,
        // whether the affected tables for a given SQL must query directly postgresql or use the SQL API
        cdbQueryTablesFromPostgres: true,
        // whether in mapconfig is available stats & metadata for each layer
        layerStats: process.env.CARTO_WINDSHAFT_LAYERSTATS_ENABLED === 'true' || false,
        // whether it should rate limit endpoints (global configuration)
        rateLimitsEnabled: false,
        // whether it should rate limit one or more endpoints (only if rateLimitsEnabled = true)
        rateLimitsByEndpoint: {
            anonymous: false,
            static: false,
            static_named: false,
            dataview: false,
            dataview_search: false,
            analysis: false,
            analysis_catalog: false,
            tile: false,
            attributes: false,
            named_list: false,
            named_create: false,
            named_get: false,
            named: false,
            named_update: false,
            named_delete: false,
            named_tiles: false
        }
    },
    pubSubMetrics: {
        enabled: process.env.CARTO_WINDSHAFT_METRICS_ENABLED === 'true' || false,
        project_id: process.env.CARTO_WINDSHAFT_METRICS_PROJECT_ID || 'avid-wavelet-844',
        credentials: '',
        topic: process.env.CARTO_WINDSHAFT_METRICS_PROJECT_ID || 'raw-metric-events'
    }
};

// override some defaults for tests
if (process.env.NODE_ENV === 'test') {
    config.user_from_host = '(.*)';
    config.postgres_auth_pass = 'test_windshaft_cartodb_user_<%= user_id %>_pass';
    config.millstone.cache_basedir = '/tmp/tile_assets';
    config.postgres.user = 'test_windshaft_publicuser';
    config.resources_url_templates = {
        http: 'http://{{=it.user}}.localhost.lan:{{=it.port}}/api/v1/map',
        https: 'https://{{=it.user}}.localhost.lan:{{=it.port}}/api/v1/map'
    };
    config.cache_enabled = false;
    config.postgres_auth_user = 'test_windshaft_cartodb_user_<%= user_id %>';
    config.renderer.mapnik.postgis.twkb_encoding = false;
    config.renderer.mapnik['cache-features'] = false;
    config.renderer.http.whitelist = [ // the whitelist of urlTemplates that can be used
        '.*', // will enable any URL
        'http://{s}.example.com/{z}/{x}/{y}.png',
        // for testing purposes
        'http://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png'
    ];
    config.analysis.batch.inlineExecution = true;
    config.redis.idleTimeoutMillis = 1;
    config.redis.reapIntervalMillis = 1;
    config.varnish.purge_enabled = false;
    config.health.enabled = false;
    config.enabledFeatures.layerStats = true;
}

module.exports = config;
