#!/usr/bin/python
import commands
import time
import re

from SimpleXMLRPCServer import SimpleXMLRPCServer
from SimpleXMLRPCServer import SimpleXMLRPCRequestHandler


# Restrict to a particular path.
class RequestHandler(SimpleXMLRPCRequestHandler):
    rpc_paths = ('/RPC2',)


class MiningAgent():
    def __init__(self):
        self.hostname = commands.getoutput("hostname")  # Get the hostname
        self.phy_interfaces = ['eno1', 'enp1s2']
        self.tun_interfaces = ['patch-tun','patch-int','vxlan_sys_4789']
        self.results = dict()

    # Create XMLRPCLIB Server
    def create_server(self):
        self.server = SimpleXMLRPCServer((self.hostname, 8000),
                                         requestHandler=RequestHandler)
        self.server.register_introspection_functions()

    def get_hardware_resources(self):
        space = '" "'
        cpu_load = 100 - float(commands.getoutput("top -b -n1 -p 1 | grep 'Cpu' | tail -1 | awk -F'id,' '{split($1,vs,"+space+"); v=vs[length(vs)];print v}'").replace(",","."))
        mem_load = (float(commands.getoutput('free -m | fgrep "Mem"').split()[2]) / float(commands.getoutput('free -m | fgrep "Mem"').split()[1])) * 100
        self.results['cpu_load'] = round(cpu_load,1)
        self.results['mem_load'] = round(mem_load,1)

    def get_pifs_stats(self):
        self.results['pifs'] = []
        for interface in self.phy_interfaces:
            pif_entry = {'name':interface}
            rx_dropped = commands.getoutput("cat /sys/class/net/" + interface + "/statistics/rx_dropped")
            rx_packets = commands.getoutput("cat /sys/class/net/" + interface + "/statistics/rx_packets")
            rx_bytes = commands.getoutput("cat /sys/class/net/" + interface + "/statistics/rx_bytes")
            tx_dropped = commands.getoutput("cat /sys/class/net/" + interface + "/statistics/tx_dropped")
            tx_packets = commands.getoutput("cat /sys/class/net/" + interface + "/statistics/tx_packets")
            tx_bytes = commands.getoutput("cat /sys/class/net/" + interface + "/statistics/tx_bytes")
            pif_entry['rx_dropped'] = float(rx_dropped)
            pif_entry['rx_packets'] = float(rx_packets)
            pif_entry['rx_bytes'] = float(rx_bytes)
            pif_entry['tx_dropped'] = float(tx_dropped)
            pif_entry['tx_packets'] = float(tx_packets)
            pif_entry['tx_bytes'] = float(tx_bytes)
            self.results['pifs'].append(pif_entry)

    def get_tun_stats(self):
        self.results['tunifs'] = []
        for interface in self.tun_interfaces:
            tunif_entry = {'name':interface}

            if interface == "vxlan_sys_4789":
                rx_dropped = commands.getoutput("cat /sys/class/net/" + interface + "/statistics/rx_dropped")
                rx_packets = commands.getoutput("cat /sys/class/net/" + interface + "/statistics/rx_packets")
                rx_bytes = commands.getoutput("cat /sys/class/net/" + interface + "/statistics/rx_bytes")
                tx_dropped = commands.getoutput("cat /sys/class/net/" + interface + "/statistics/tx_dropped")
                tx_packets = commands.getoutput("cat /sys/class/net/" + interface + "/statistics/tx_packets")
                tx_bytes = commands.getoutput("cat /sys/class/net/" + interface + "/statistics/tx_bytes")
            else:
                data = commands.getoutput("ovs-vsctl get Interface " + interface + " statistics")
                map = {}
                pair_re = re.compile('(\w+)=(\d+)')
                map.update(pair_re.findall(data))
                rx_dropped = 0
                rx_packets = map['rx_packets']
                rx_bytes = map['rx_bytes']
                tx_dropped = 0
                tx_packets = map['tx_packets']
                tx_bytes = map['tx_bytes']

            tunif_entry['rx_dropped'] = float(rx_dropped)
            tunif_entry['rx_packets'] = float(rx_packets)
            tunif_entry['rx_bytes'] = float(rx_bytes)
            tunif_entry['tx_dropped'] = float(tx_dropped)
            tunif_entry['tx_packets'] = float(tx_packets)
            tunif_entry['tx_bytes'] = float(tx_bytes)
            self.results['tunifs'].append(tunif_entry)

    def cpu_back_queue_stats(self):
        self.results['cpu_back_queue'] = []
        processed_packets_per_core = commands.getoutput("cat /proc/net/softnet_stat | awk '{print $1}'").split("\n")
        dropped_packets_per_core = commands.getoutput("cat /proc/net/softnet_stat | awk '{print $2}'").split("\n")
        numCores = len(processed_packets_per_core)
        for x in range(0, numCores):
            queue_entry = {'name':x}
            queue_entry = {}
            queue_entry['processed_packets'] = int(processed_packets_per_core[x], 16)
            queue_entry['dropped_packets'] = int(dropped_packets_per_core[x], 16)
            self.results['cpu_back_queue'].append(queue_entry)

    def get_vifs_stats(self):
        self.results['vifs'] = dict()
        tap_interfaces = commands.getoutput("ip -o  link show | grep tap | cut -d ' ' -f 2,22").split('\n')
        for tap in tap_interfaces:
            tap = tap.split(': ')
            mac = tap[1][3:]
            self.results['vifs'][mac] = {'tap_stats': dict(), 'qvb_stats': dict(), 'qvo_stats': dict()}
            suffix = tap[0][3:]
            bridges = commands.getoutput("ip -o link show | cut -d':' -f2 | grep " + suffix).split()
            for bridge in bridges:
                bridge = bridge.split('@')[0]
                if "tap" in bridge:
                    index = 'tap_stats'
                elif "qvb" in bridge:
                    index = 'qvb_stats'
                elif "qvo" in bridge:
                    index = 'qvo_stats'
                else:
                    continue
                rx_dropped = commands.getoutput("cat /sys/class/net/" + bridge + "/statistics/rx_dropped")
                rx_packets = commands.getoutput("cat /sys/class/net/" + bridge + "/statistics/rx_packets")
                rx_bytes = commands.getoutput("cat /sys/class/net/" + bridge + "/statistics/rx_bytes")
                tx_dropped = commands.getoutput("cat /sys/class/net/" + bridge + "/statistics/tx_dropped")
                tx_packets = commands.getoutput("cat /sys/class/net/" + bridge + "/statistics/tx_packets")
                tx_bytes = commands.getoutput("cat /sys/class/net/" + bridge + "/statistics/tx_bytes")
                self.results['vifs'][mac][index]['rx_dropped'] = float(rx_dropped)
                self.results['vifs'][mac][index]['rx_packets'] = float(rx_packets)
                self.results['vifs'][mac][index]['rx_bytes'] = float(rx_bytes)
                self.results['vifs'][mac][index]['tx_dropped'] = float(tx_dropped)
                self.results['vifs'][mac][index]['tx_packets'] = float(tx_packets)
                self.results['vifs'][mac][index]['tx_bytes'] = float(tx_bytes)
                self.results['vifs'][mac][index]['name'] = bridge

    def get_stats(self):
        self.results = {'timestamp': time.time()}
        self.get_hardware_resources()
        self.get_pifs_stats()
        self.get_tun_stats()
        self.cpu_back_queue_stats()
        self.get_vifs_stats()
        return self.results

    def start_agent_service(self):
        self.create_server()
        self.server.register_function(self.get_stats, 'get_stats')
        self.server.serve_forever()

if __name__ == '__main__':
    # Run the server's main loop
    try:
        print 'Use Control-C to exit'
        agent = MiningAgent()
        #print agent.get_stats()
        agent.start_agent_service()
    except KeyboardInterrupt:
        print 'Exiting'
