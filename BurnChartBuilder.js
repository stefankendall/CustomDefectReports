(function () {

    Ext.define('Rally.app.analytics.BurnChartBuilder', {
        mixins:{
            componentUpdatable: 'Rally.util.ComponentUpdatable'
        },
        build:function (requestedQuery, buildFinishedCallback) {
            var query = {};
            query.find = Ext.encode(requestedQuery.find);
            query.pagesize = 1000;

            var requestedFields = Ext.Array.union(['_ValidFrom', '_ValidTo', 'ObjectID', 'ScheduleState'], requestedQuery.fields ? requestedQuery.fields : []);

            var workspace = Rally.util.Ref.getOidFromRef(Rally.environment.getContext().context.scope.workspace._ref);
            Ext.Ajax.request({
                url:"https://rally1.rallydev.com/analytics/1.27/" + workspace + "/artifact/snapshot/query.js?" + Ext.Object.toQueryString(query) +
                    "&fields=" + JSON.stringify(requestedFields) + "&sort={_ValidFrom:1}",
                method:"GET",
                headers:{
                    Authorization:'Basic dG9vbGJvdEByYWxseWRldi5jb206YWJjMTIzISE='
                },
                success:function (response) {
                    var me = this;
                    this.getAcceptedScheduleStateOid(function(acceptedScheduleStateOid){
                        me._afterQueryReturned(JSON.parse(response.responseText), acceptedScheduleStateOid, buildFinishedCallback);
                    });
                },
                scope:this
            });
        },
        getAcceptedScheduleStateOid:function (callback) {
            var workspace = Rally.util.Ref.getOidFromRef(Rally.environment.getContext().context.scope.workspace._ref);
            var project = Rally.util.Ref.getOidFromRef(Rally.environment.getContext().context.scope.project._ref);
            var analyticsScheduleStateQuery = "find={ScheduleState:'Accepted',Project:" + project + "}&fields=['ScheduleState']&pagesize=1";
            Ext.Ajax.request({
                url:"https://rally1.rallydev.com/analytics/1.27/" + workspace + "/artifact/snapshot/query.js?" + analyticsScheduleStateQuery,
                method:"GET",
                headers:{
                    Authorization:'Basic dG9vbGJvdEByYWxseWRldi5jb206YWJjMTIzISE='
                },
                success:function (response) {
                    callback(JSON.parse(response.responseText).Results[0].ScheduleState);
                },
                scope:this
            });
        },
        _afterQueryReturned:function (queryResultsData, acceptedScheduleStateOid, buildFinishedCallback) {
            console.log( queryResultsData );
            var lumenize = require('./lumenize');
            var contextWorkspaceConfig = Rally.environment.getContext().context.scope.workspace.WorkspaceConfiguration;
            var workspaceConfiguration = {
                // Need to grab from Rally for this user
                DateFormat:contextWorkspaceConfig.DateFormat,
                DateTimeFormat:contextWorkspaceConfig.DateTimeFormat,
                //TODO: Have context code fetch these values for the workspace config, instead of hardcoding them
                IterationEstimateUnitName:'Points',
                // !TODO: Should we use this?
                ReleaseEstimateUnitName:'Points',
                TaskUnitName:'Hours',
                TimeTrackerEnabled:true,
                TimeZone:'America/Denver',
                WorkDays:'Sunday,Monday,Tuesday,Wednesday,Thursday,Friday'
                // They work on Sundays
            };
            var burnConfig = {
                workspaceConfiguration:workspaceConfiguration,
                upSeriesType:'Story Count',
                // 'Points' or 'Story Count'
                series:[
                    'up',
                    'scope'
                ],

                acceptedStates:[acceptedScheduleStateOid],
                start:"2012-02-18T00:00:00.000Z",
                // Calculated either by inspecting results or via configuration. pastEnd is automatically the last date in results
                holidays:[
                    {
                        month:12,
                        day:25
                    },
                    {
                        year:2011,
                        month:11,
                        day:26
                    },
                    {
                        year:2011,
                        month:1,
                        day:5
                    }
                ]
            };
            lumenize.ChartTime.setTZPath("");

            var tscResults = burnCalculator(queryResultsData.Results, burnConfig);
            //var tscResults = burnCalculator(results, config);
            var categories = tscResults.categories;
            var series = tscResults.series;
            console.log( series );
            var chartConfiguration = {
                id:'chart_test',
                xtype:'highchart',
                chartConfig:{
                    chart:{
                        defaultSeriesType:'column'
                    },
                    credits:{
                        enabled:false
                    },
                    title:{
                        text:'Burn Chart'
                    },
                    subtitle:{
                        text:''
                    },
                    xAxis:{
                        categories:categories,
                        tickmarkPlacement:'on',
                        tickInterval:Math.floor(categories.length / 13) + 1,
                        // set as a function of the length of categories
                        title:{
                            enabled:false
                        }
                    },
                    yAxis:[
                        {
                            title:{
                                text:'Hours'
                            },
                            labels:{
                                formatter:function () {
                                    return this.value / 1;
                                }
                            },
                            min:0
                        },
                        {
                            title:{
                                text:burnConfig.upSeriesType
                            },
                            opposite:true,
                            labels:{
                                formatter:function () {
                                    return this.value / 1;
                                }
                            },
                            min:0
                        }
                    ],
                    tooltip:{
                        formatter:function () {
                            return '' + this.x + '<br />' + this.series.name + ': ' + this.y;
                        }
                    },
                    plotOptions:{
                        column:{
                            stacking:null,
                            lineColor:'#666666',
                            lineWidth:1,
                            marker:{
                                lineWidth:1,
                                lineColor:'#666666'
                            }
                        }
                    },
                    series:series
                }
            };

            buildFinishedCallback(chartConfiguration);
        }
    });
})();