var app = angular.module('perfchecker', ['nvd3'])

.controller('PerfCheckerCtrl', function($scope, $compile) {

    $scope.options = {
        chart: {
            type: 'lineChart',
            //height: 180,
            height: 350,
            margin : {
                top: 20,
                right: 20,
                bottom: 40,
                left: 55
            },
            x: function(d){ return d.x; },
            y: function(d){ return d.y; },
            useInteractiveGuideline: true,
            color: d3.scale.category10().range(),
            duration: 0,
            xAxis: {
                tickFormat: function(d) {
                        return d3.time.format('%H:%M:%S')(new Date(d))
                }
            },
            yAxis: {
                axisLabelDistance: -20,
                tickFormat: function(d){
                        return d3.format(',.1f')(d);
                }
             }
        }
    };

    $scope.run = true;

    var data = {};
    var elem = document.getElementsByClassName("container-fluid")[1];
    
    var intBlocks = {
        physical:{title:'Physical Interfaces',subtype:'phy',index:'pifs'},
        tun:{title:'TUN Interfaces',subtype:'tun',index:'tunifs'},
        virtual:{title:'VM Interfaces',subtype:'virt',index:'vifs'}
    };

    var cpuChart = {title:'CPU Load',type:'cpu',yAxisLabel:'percentage (%)',key:'CPU Load',index:'cpu_load',yRange:[0,100]};
    
    var memChart = {title:'Memory Load',type:'mem',yAxisLabel:'percentage (%)',key:'Mem Load',index:'mem_load',yRange:[0,100]};

    var phyChart = [
        {title:'Processed Bytes',type:'phybytes',yAxisLabel:'Kbytes/second',keys:['TX','RX'],indexes:['tx_bytes','rx_bytes'],yRange:[0,10000]},
        {title:'Processed Packets',type:'phypack',yAxisLabel:'(x100) packets/second',keys:['Processed (TX)','Processed (RX)','Dropped (TX)','Dropped (RX)'],indexes:['tx_packets','rx_packets','tx_dropped','rx_dropped'],yRange:[0,10000]}
    ];

    var tunChart = [
        {title:'Processed Bytes',type:'tunbytes',yAxisLabel:'Kbytes/second',keys:['TX','RX'],indexes:['tx_bytes','rx_bytes'],yRange:[0,10000]},
        {title:'Processed Packets',type:'tunprocpack',yAxisLabel:'(x100) packets/second',keys:['(TX)','(RX)'],indexes:['tx_packets','rx_packets'],yRange:[0,10000]},
        {title:'Dropped Packets',type:'tundroppack',yAxisLabel:'(x100) packets/second',keys:['(TX)','(RX)'],indexes:['tx_dropped','rx_dropped'],yRange:[0,10000]}
    ];

    var vifChart = [
        {title:'Processed Bytes',type:'vifbytes',yAxisLabel:'Kbytes/second',keys:['TX','RX'],indexes:['tx_bytes','rx_bytes'],yRange:[0,10000]},
        {title:'Processed Packets',type:'vifprocpack',yAxisLabel:'(x100) packets/second',keys:['(TX)','(RX)'],indexes:['tx_packets','rx_packets'],yRange:[0,10000]},
        {title:'Dropped Packets',type:'vifdroppack',yAxisLabel:'(x100) packets/second',keys:['(TX)','(RX)'],indexes:['tx_dropped','rx_dropped'],yRange:[0,10000]}
    ];

    var cpuQueueChart = [
        {title:'Dropped Packets',type:'queuedrop',yAxisLabel:'(x100) packets/second',key:'TX/RX',index:'dropped_packets',yRange:[0,10000]},
        {title:'Processed Packets',type:'queueproc',yAxisLabel:'(x100) packets/second',key:'TX/RX',index:'processed_packets',yRange:[0,10000]}
    ];

    function createBlock(title,subclass){
        var div_block_server = document.createElement("div");
        div_block_server.className = "row " + subclass;
        var h3_block_server = document.createElement("h3");
        var h3_block_server_text = document.createTextNode(title);
        h3_block_server.appendChild(h3_block_server_text);
        div_block_server.appendChild(h3_block_server);
        return div_block_server;
    }

    function createSubBlock(title){
        var div_subblock_server_col = document.createElement("div");
        div_subblock_server_col.className = "col-sm-12";
        var h4_subblock_server = document.createElement("h4");
        var h4_subblock_server_text = document.createTextNode(title);
        var line = document.createElement("hr");
        h4_subblock_server.appendChild(h4_subblock_server_text);
        div_subblock_server_col.appendChild(line);
        div_subblock_server_col.appendChild(h4_subblock_server);
        return div_subblock_server_col;
    }

    function createSubSubBlock(title){
        var div_subsubblock_server_col = document.createElement("div");
        div_subsubblock_server_col.className = "row";
        var h4_subsubblock_server = document.createElement("h4");
        var h4_subsubblock_server_text = document.createTextNode(title);
        h4_subsubblock_server.appendChild(h4_subsubblock_server_text);
        div_subsubblock_server_col.appendChild(h4_subsubblock_server);
        return div_subsubblock_server_col;
    }

    function shiftListValues(listValues) {
        if (listValues.length > 50) listValues.shift();
    }

    function getOptionsDataChart(serverName,type) {
        var index = serverName+type;
        index = index.split("-").join("");
        index = index.split(".").join("");
        index = index.split(":").join("");
        return ["options"+index,"data"+index,"api"+index];
    }

    function createChartStructure() {
        var chart_structure = document.createElement("div");
        chart_structure.className = "col-sm-12";
        return chart_structure;
    }

    function createChartWrapper(){
        var chart_wrapper_structure = document.createElement("div");
        chart_wrapper_structure.className = "chart-wrapper";
        return chart_wrapper_structure;
    }

    function createChartTitle(title){
        var chart_title = document.createElement("div");
        chart_title.className = "chart-title";
        var chart_title_text = document.createTextNode(title);
        chart_title.appendChild(chart_title_text);
        return chart_title;
    }

    function createChartStage(elemCharts){
        $scope[elemCharts[0]] = angular.copy($scope.options);
        var chart_stage = document.createElement("div");
        chart_stage.className = "chart-stage";
        var chart_stage_nvd3 = "<nvd3 options='"+elemCharts[0]+"' data='"+elemCharts[1]+"' api='"+elemCharts[2]+"' config='{deepWatchData: false}'></nvd3>";
        angular.element(chart_stage).append($compile(chart_stage_nvd3)($scope));
        return chart_stage;
    }

    function createBasicChart(elemCharts,objectName,descChart) {
        
        var chart_structure = createChartStructure();
        var chart_wrapper_structure = createChartWrapper();
        var title;
        
        if (objectName == "") {
            title = descChart.title;
        } else {
            title = objectName + ": " + descChart.title;
        }

        var chart_title = createChartTitle(title);
        var chart_stage = createChartStage(elemCharts);

        chart_wrapper_structure.appendChild(chart_title);
        chart_wrapper_structure.appendChild(chart_stage);
        chart_structure.appendChild(chart_wrapper_structure);

        $scope[elemCharts[0]].chart.yAxis.axisLabel = descChart.yAxisLabel;
        
        return chart_structure;
    }

    function initializeCPUDataChart(dataChart) {
        $scope[dataChart] = [{ values: [], key: cpuChart.key }];     
    }

    function initializeMemDataChart(dataChart) {
        $scope[dataChart] = [{ values: [], key: memChart.key }];     
    }

    function initializePhyDataChart(dataChart,descChart) {
        var i;
        var len = descChart['keys'].length;
        $scope[dataChart] = [];
        for (i = 0; i < len; i++) {
            $scope[dataChart].push({ values: [], key: descChart['keys'][i] });
        }        
    }

    function initializeTunDataChart(dataChart,interfaces,descChart) {
        var i,j;
        var lenKeys = descChart['keys'].length;
        var lenIfs = interfaces.length;
        $scope[dataChart] = [];
        for (i = 0; i < lenKeys; i++) {
            for (j = 0; j < lenIfs; j++) {
                var keyLabel = interfaces[j].name + ": " + descChart['keys'][i];
                $scope[dataChart].push({ values: [], key: keyLabel });
            }
        }        
    }

    function initializeCPUQueueDataChart(dataChart,len) {
        var i;
        $scope[dataChart] = [];
        for (i = 1; i <= len; i++) {
            $scope[dataChart].push({ values: [], key: "Core "+i });
        }        
    }

    function initializeVifDataChart(dataChart,interface,descChart) {
        var i,j;
        var lenKeys = descChart['keys'].length;
        $scope[dataChart] = [];
        for (i = 0; i < lenKeys; i++) {
            var tapKeyLabel = interface['tap_stats'].name + ": " + descChart['keys'][i];
            var qvbKeyLabel = interface['qvb_stats'].name + ": " + descChart['keys'][i];
            var qvoKeyLabel = interface['qvo_stats'].name + ": " + descChart['keys'][i];
            $scope[dataChart].push({ values: [], key: tapKeyLabel });
            $scope[dataChart].push({ values: [], key: qvbKeyLabel });
            $scope[dataChart].push({ values: [], key: qvoKeyLabel });
        }        
    }

    function updateCPUMemChart(server,descChart) {
        var value = server[descChart.index];
        var elem_charts = getOptionsDataChart(server.name,descChart.type);
        var data_chart = elem_charts[1];
        var api_chart = elem_charts[2];
        $scope[data_chart][0].values.push({ x: server.timestamp,y: value});
        shiftListValues($scope[data_chart][0].values);
        $scope[api_chart].update();
    }

    function updatePhyChart(server,interface,descChart) {
        var elemCharts = getOptionsDataChart(server.name+interface.name,descChart.type);
        var data_chart = elemCharts[1];
        var api_chart = elemCharts[2];
        var timestamp = server.timestamp;
        
        var i;
        var len = descChart['keys'].length;

        for (i = 0; i < len; i++) {
            var value = parseFloat(interface[descChart.indexes[i]]);
            $scope[data_chart][i].values.push({ x: timestamp,y: value});
        }  

        $scope[api_chart].update();
    }

    function updateTunChart(server,interfaces,descChart) {
        var elemCharts = getOptionsDataChart(server.name,descChart.type);
        var data_chart = elemCharts[1];
        var api_chart = elemCharts[2];
        var timestamp = server.timestamp;
        
        var i,j;
        var count = 0;
        var lenKeys = descChart['keys'].length;
        var lenIfs = interfaces.length;

        for (i = 0; i < lenKeys; i++) {
            for (j = 0; j < lenIfs; j++) {
                var value = parseFloat(interfaces[j][descChart.indexes[i]]);
                $scope[data_chart][count].values.push({ x: timestamp,y: value});
                count++;
            }
        }  

        $scope[api_chart].update();
    }

    function updateCPUQueueChart(server,descChart) {
        var elemCharts = getOptionsDataChart(server.name,descChart.type);
        var data_chart = elemCharts[1];
        var api_chart = elemCharts[2];
        var timestamp = server.timestamp;
        var len = server['cpu_back_queue'].length;
        var i;
        for (i = 0; i < len; i++) {
            var value = parseFloat(server['cpu_back_queue'][i][descChart.index]);
            $scope[data_chart][i].values.push({ x: timestamp,y: value});
            shiftListValues($scope[data_chart][i].values);
        }
        $scope[api_chart].update();
    }    

    function updateVifChart(server,interface,descChart) {
        var elemCharts = getOptionsDataChart(server.name+interface.mac,descChart.type);
        var data_chart = elemCharts[1];
        var api_chart = elemCharts[2];
        var timestamp = server.timestamp;
        
        var i,j;
        var count = 0;
        var lenKeys = descChart['keys'].length;

        for (i = 0; i < lenKeys; i++) {
            var tapValue = parseFloat(interface['tap_stats'][descChart.indexes[i]]);
            var qvbValue = parseFloat(interface['qvb_stats'][descChart.indexes[i]]);
            var qvoValue = parseFloat(interface['qvo_stats'][descChart.indexes[i]]);
            $scope[data_chart][count++].values.push({ x: timestamp,y: tapValue});
            $scope[data_chart][count++].values.push({ x: timestamp,y: qvbValue});
            $scope[data_chart][count++].values.push({ x: timestamp,y: qvoValue});
        }  

        $scope[api_chart].update();
    }

    function createCPUMemBlock(server) {
        var div_block = createBlock("CPU and Memory","cpumem");
        var elem_charts_cpu = getOptionsDataChart(server.name,cpuChart.type);
        initializeCPUDataChart(elem_charts_cpu[1]);
        var div_block_cpu = createBasicChart(elem_charts_cpu,"",cpuChart);
        var elem_charts_mem = getOptionsDataChart(server.name,memChart.type);
        initializeMemDataChart(elem_charts_mem[1]);
        var div_block_mem = createBasicChart(elem_charts_mem,"",memChart);
        div_block.appendChild(div_block_cpu);
        div_block.appendChild(div_block_mem);
        return div_block;
    }

    function createPhyBlock(server) {
        var div_block = createBlock(intBlocks.physical.title,intBlocks.physical.subtype);
        var len = server[intBlocks.physical.index].length;
        var i;
        for (i = 0; i < len; i++) {
            var int_name = server[intBlocks.physical.index][i].name;
            var div_subblock = createSubBlock("Interface: " + int_name);
            var div_subsubblock = createSubSubBlock("");
            
            var elem_charts_packets = getOptionsDataChart(server.name+int_name,phyChart[0].type);
            initializePhyDataChart(elem_charts_packets[1],phyChart[0]);
            var div_block_packets = createBasicChart(elem_charts_packets,int_name,phyChart[0]);
            div_subsubblock.appendChild(div_block_packets)

            var elem_charts_bytes = getOptionsDataChart(server.name+int_name,phyChart[1].type);
            initializePhyDataChart(elem_charts_bytes[1],phyChart[1]);
            var div_block_bytes = createBasicChart(elem_charts_bytes,int_name,phyChart[1]);
            div_subsubblock.appendChild(div_block_bytes)

            div_subblock.appendChild(div_subsubblock);
            div_block.appendChild(div_subblock);
        }
        return div_block
    }

    function createTunBlock(server) {
        var div_block = createBlock(intBlocks.tun.title,intBlocks.tun.subtype);
        
        var interfaces = server[intBlocks.tun.index];
        
        var numCharts = tunChart.length;
        var i;
        for (i = 0; i < numCharts; i++) {
            var elem_charts = getOptionsDataChart(server.name,tunChart[i].type);
            initializeTunDataChart(elem_charts[1],interfaces,tunChart[i]);
            var div_block_chart = createBasicChart(elem_charts,"",tunChart[i]);
            div_block.appendChild(div_block_chart);
        }

        return div_block
    }

    function createCPUQueueBlock(server) {
        var len = server['cpu_back_queue'].length;
        var div_block = createBlock("CPU Backlog Queues","queue");
        
        var elem_charts_queue_dropped = getOptionsDataChart(server.name,cpuQueueChart[0].type);
        initializeCPUQueueDataChart(elem_charts_queue_dropped[1],len);
        var div_block_queue_dropped = createBasicChart(elem_charts_queue_dropped,"",cpuQueueChart[0]);
        
        var elem_charts_queue_processed = getOptionsDataChart(server.name,cpuQueueChart[1].type);
        initializeCPUQueueDataChart(elem_charts_queue_processed[1],len);
        var div_block_queue_processed = createBasicChart(elem_charts_queue_processed,"",cpuQueueChart[1]);
        
        div_block.appendChild(div_block_queue_dropped);
        div_block.appendChild(div_block_queue_processed);
        
        return div_block
    }

    function createVMBlock(server) {
        var div_block = createBlock("Virtual Machines","vm");
        var vmLen = server['virtual_machines'].length;
        var numCharts = vifChart.length;
        var i,j,m;
        for (i = 0; i < vmLen; i++) {
            var vm_name = server['virtual_machines'][i].name;
            var tenant_name = server['virtual_machines'][i].tenant_name;
            //var prefix_vm_name = vm_name + tenant_name;
            var div_subblock = createSubBlock("VM: " + vm_name + " - Tenant: " + tenant_name);
            div_subblock.addClassName = tenant_name;
            var div_subsubblock = createSubSubBlock("");
            
            var vifsLen = server['virtual_machines'][i].vifs.length;
            for (j = 0; j < vifsLen; j++) {
                var vif = server['virtual_machines'][i].vifs[j];
                var div_vif_block = createSubBlock("VIF IP: " + vif.name);
                var div_vif_subblock = createSubSubBlock("");

                for (m = 0; m < numCharts; m++) {
                    var elem_charts = getOptionsDataChart(server.name+vif.mac,vifChart[m].type);
                    initializeVifDataChart(elem_charts[1],vif,vifChart[m]);
                    var div_block_chart = createBasicChart(elem_charts,"",vifChart[m]);
                    div_vif_subblock.appendChild(div_block_chart);
                }

                div_vif_block.appendChild(div_vif_subblock);
                div_subsubblock.appendChild(div_vif_block);
            }

            div_subblock.appendChild(div_subsubblock);
            div_block.appendChild(div_subblock);
        }
        return div_block
    }

    function updateCPUMemBlock(server) {
        updateCPUMemChart(server,cpuChart);
        updateCPUMemChart(server,memChart);
    }

    function updatePhyBlock(server) {
        var len = server[intBlocks.physical.index].length;
        var i;
        for (i = 0; i < len; i++) {
            var interface = server[intBlocks.physical.index][i];
            updatePhyChart(server,interface,phyChart[0]);
            updatePhyChart(server,interface,phyChart[1]);
        }
    }

    function updateTunBlock(server) {
        var interfaces = server[intBlocks.tun.index];
        var numCharts = tunChart.length;
        var i;
        for (i = 0; i < numCharts; i++) {
            updateTunChart(server,interfaces,tunChart[i]);
        }
    }

    function updateCPUQueueBlock(server) {
        updateCPUQueueChart(server,cpuQueueChart[0]);
        updateCPUQueueChart(server,cpuQueueChart[1]);
    }

    function updateVMBlock(server) {
        var vmLen = server['virtual_machines'].length;
        var numCharts = tunChart.length;
        var i,j,m;
        for (i = 0; i < vmLen; i++) {
            var vifsLen = server['virtual_machines'][i].vifs.length;
            var j;
            for (j = 0; j < vifsLen; j++) {
                var vif = server['virtual_machines'][i].vifs[j];
                for (m = 0; m < numCharts; m++) {
                    updateVifChart(server,vif,vifChart[m]);
                }
            }
        }
    }

    function createServerChartSpace(serverName) {
        var servers_check = document.getElementById("serversCheck");
        var button = "<label id='"+serverName+"select' class='btn btn-primary active'><input type='checkbox' autocomplete='off'>"+serverName+"</label>"
        angular.element(servers_check).append(button);
        $("#serversCheck #"+serverName+"select").on("click", function () {
            if ($(this).hasClass("active")) {
                $("#"+serverName).hide();
            } else {
                $("#"+serverName).show();
            }
        });
        var div_server = document.createElement("div");
        div_server.id = serverName;
        var h2_server = document.createElement("h2");
        var h2_server_text = document.createTextNode("Server Name: " + serverName);
        var line_server = document.createElement("hr");
        var new_line_server = document.createElement("br");
        h2_server.appendChild(h2_server_text);
        div_server.appendChild(line_server);
        div_server.appendChild(h2_server);
        div_server.appendChild(line_server);
        div_server.appendChild(new_line_server);
        return div_server;
    }

    function processJsonResults(error, resultsJson) {
        if (resultsJson != null) {
            var servers = resultsJson.servers;
            var len = servers.length;
            var i;
            for (i = 0; i < len; i++) {
               if (data[servers[i].name]==undefined) {
                    var div_server = createServerChartSpace(servers[i].name);
                    var div_cpu_mem_row_server = createCPUMemBlock(servers[i]);
                    var div_phys_row_server = createPhyBlock(servers[i]);
                    var div_tun_row_server = createTunBlock(servers[i]);
                    var div_cpuqueue_row_server = createCPUQueueBlock(servers[i]);
                    var div_vm_row_server = createVMBlock(servers[i]);
                    div_server.appendChild(div_cpu_mem_row_server);
                    div_server.appendChild(div_phys_row_server);
                    div_server.appendChild(div_tun_row_server);
                    div_server.appendChild(div_cpuqueue_row_server);
                    div_server.appendChild(div_vm_row_server);
                    elem.appendChild(div_server);
                    data[servers[i].name] = {};
                } else {
                    updateCPUMemBlock(servers[i]);
                    updatePhyBlock(servers[i],intBlocks.physical);
                    updateTunBlock(servers[i],intBlocks.tun);
                    updateCPUQueueBlock(servers[i]);
                    updateVMBlock(servers[i]);
                }
            }
        }
    }

    function collectJsonResults() {
        queue().defer(d3.json, "/perfchecker/results").await(processJsonResults);
    }

    $("#chartsCheck .btn").on("click", function () {
        if ($(this).hasClass("active")) {
            if ($(this).hasClass("cpumemchart")) {
                $(".cpumem").hide();
            } else if ($(this).hasClass("phychart")) {
                $("."+intBlocks.physical.subtype).hide();
            } else if ($(this).hasClass("tunchart")) {
                $("."+intBlocks.tun.subtype).hide();
            } else if ($(this).hasClass("queuechart")) {
                $(".queue").hide();
            } else if ($(this).hasClass("vmchart")) {
                $(".vm").hide();
            }
        } else {
            if ($(this).hasClass("cpumemchart")) {
                $(".cpumem").show();
            } else if ($(this).hasClass("phychart")) {
                $("."+intBlocks.physical.subtype).show();
            } else if ($(this).hasClass("tunchart")) {
                $("."+intBlocks.tun.subtype).show();
            } else if ($(this).hasClass("queuechart")) {
                $(".queue").show();
            } else if ($(this).hasClass("vmchart")) {
                $(".vm").show();
            }
        }
    });

    queue().defer(d3.json, "/perfchecker/results").await(processJsonResults);

    setInterval(function(){
        if (!$scope.run) return;
        collectJsonResults();
        $scope.$apply(); // update all charts
    }, 5000);

 });