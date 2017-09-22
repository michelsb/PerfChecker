#!/usr/bin/python

from keystoneauth1 import loading
from keystoneauth1 import session
from novaclient import client
from random import randint
from deepdiff import DeepDiff

import time
import xmlrpclib
import threading

class MiningManager():
    def __init__(self):
        self.servers = []
        self.retry = 3
        self.up_servers = []
        self.down_servers = []
        self.conn = dict()
        self.new_results = {}
        self.old_results = {}
        self.current_metrics = {}
        self.diff_time = 0.0
        self.firstTime = True

    def add_up_server(self, server):
        print ("Server " + server + " up!")
        self.up_servers.append(server)
        if server in self.down_servers:
            self.down_servers.remove(server)

    def add_down_server(self, server):
        print ("Server " + server + " down!")
        self.down_servers.append(server)
        if server in self.up_servers:
            self.up_servers.remove(server)

    def connect_nova(self):
        try:
            ref_file = open("parameters.txt", "r")
            for line in ref_file:
                field = line.split(':')[0].split()[0]
                if field == 'username':
                    self.username = line.split(':')[1].split()[0]
                elif field == 'password':
                    self.password = line.split(':')[1].split()[0]
                elif field == 'project_id':
                    self.project_id = line.split(':')[1].split()[0]
            self.loader = loading.get_plugin_loader('password')
            self.auth = self.loader.load_from_options(auth_url='http://controller:5000/v2.0/',
                                                      username=self.username,
                                                      password=self.password,
                                                      project_id=self.project_id)
            self.sess = session.Session(auth=self.auth)
            self.nova = client.Client(2, session=self.sess)
            ref_file.close()
            return True
        except Exception, err:
            #print("Error accessing " + server)
            print("Message   :", err)
            self.nova = None
        return False

    def create_session_nova(self):
        for i in range(0, self.retry):
            print("Trying connect with nova... (" + str(i) + ")")
            if self.connect_nova():
                print("Nova Successfuly Connected!")
                break
            time.sleep(5)
        else:
            print("ERROR: It is not possible establish a connection with nova. Exiting...")
            quit()

    def connect_server(self, server):
        try:
            self.conn[server] = xmlrpclib.ServerProxy('http://' + server + ':8000')
            self.add_up_server(server)
            return True
        except Exception, err:
            print("Error accessing " + server)
            print("Message   :", err)
            self.add_down_server(server)
        return False

    def connect_servers(self):
        ref_file = open("server.txt", "r")
        servers = []
        for line in ref_file:
            server = line.split()[0]
            if '#' not in server:
                servers.append(server)
        for server in servers:
            self.connect_server(server)
        ref_file.close()

    def try_connect_down_servers(self):
        for server in self.down_servers:
            self.connect_server(server)

    def get_stats_from_server(self, server):
        server_entry = {'name':server,'timestamp': 0.0,'cpu_load':0.0,'mem_load':0.0,
                        'pifs':[],'tunifs':[],'cpu_back_queue':[],'virtual_machines':[]}

        # Get remote data from server
        try:
            remote_stats = self.conn[server].get_stats()
            server_entry['timestamp'] = remote_stats['timestamp']
            server_entry['cpu_load'] = remote_stats['cpu_load']
            server_entry['mem_load'] = remote_stats['mem_load']
            server_entry['pifs'] = remote_stats['pifs']
            server_entry['tunifs'] = remote_stats['tunifs']
            server_entry['cpu_back_queue'] = remote_stats['cpu_back_queue']
        except (xmlrpclib.Fault, xmlrpclib.ProtocolError, xmlrpclib.ResponseError) as err:
            print("A fault occurred")
            print("Fault code: " + str(err.faultCode))
            print ("Fault string: " + err.faultString)
            # In case of exception in the connection, return the server to the list of down servers
            self.add_down_server(server)
            return False

        try:
            for vm in self.nova.servers.list(search_opts={'host': server, 'status': 'ACTIVE', 'all_tenants': 1}):

                tenant_id = str(vm.tenant_id)
                #vm_id = str(vm.id)
                vm_name = str(vm.name)
                vm_entry = {'name': vm_name, 'tenant_name': tenant_id, 'vifs': []}

                for interface in vm.interface_list():
                    #vif_entry = {'vif_stats': dict(), 'tap_stats': dict(), 'qvb_stats': dict(), 'qvo_stats': dict()}
                    vif_entry = {'tap_stats': dict(), 'qvb_stats': dict(), 'qvo_stats': dict()}
                    vif_entry['name'] = interface.fixed_ips[0]['ip_address']
                    mac = str(interface.mac_addr)
                    vif_entry['mac'] = mac
                    vif_entry['tap_stats'] = remote_stats['vifs'][mac[3:]]['tap_stats']
                    #vif_entry['vif_stats'] = vif_entry['tap_stats'] # TODO
                    vif_entry['qvb_stats'] = remote_stats['vifs'][mac[3:]]['qvb_stats']
                    vif_entry['qvo_stats'] = remote_stats['vifs'][mac[3:]]['qvo_stats']
                    vm_entry['vifs'].append(vif_entry)

                server_entry['virtual_machines'].append(vm_entry)

        except Exception, err:
            print("Error accessing " + server)
            print("Message   :", err)
            return False

        print("Stats from server " + server + " captured...")

        self.new_results['servers'].append(server_entry)

        return True

    def locate_elem_list (self, list, value):
        for x in list:
            if x['name'] == value:
                return x
        return None

    def diff_int_stats(self,old_stats,new_stats):
        new_stats['rx_dropped'] = round(((new_stats['rx_dropped'] - old_stats['rx_dropped'])/100)/self.diff_time,1)
        new_stats['rx_packets'] = round(((new_stats['rx_packets'] - old_stats['rx_packets'])/100)/self.diff_time,1)
        new_stats['rx_bytes'] = round(((new_stats['rx_bytes'] - old_stats['rx_bytes'])/1000)/self.diff_time,1)
        new_stats['tx_dropped'] = round(((new_stats['tx_dropped'] - old_stats['tx_dropped'])/100)/self.diff_time,1)
        new_stats['tx_packets'] = round(((new_stats['tx_packets'] - old_stats['tx_packets'])/100)/self.diff_time,1)
        new_stats['tx_bytes'] = round(((new_stats['tx_bytes'] - old_stats['tx_bytes'])/1000)/self.diff_time,1)

    def diff_queue_stats(self,old_stats,new_stats):
        new_stats['processed_packets'] = round(((new_stats['processed_packets'] - old_stats['processed_packets'])/100)/self.diff_time,1)
        new_stats['dropped_packets'] = round(((new_stats['dropped_packets'] - old_stats['dropped_packets'])/100)/self.diff_time,1)


    def diff_vm_stats(self, list_old_stats, list_new_stats):
        for elem_new_stats in list_new_stats:
            elem_old_stats = self.locate_elem_list(list_old_stats,elem_new_stats['name'])
            if (elem_old_stats is not None):
                #self.diff_int_stats(elem_old_stats['vif_stats'], elem_new_stats['vif_stats'])
                self.diff_int_stats(elem_old_stats['tap_stats'], elem_new_stats['tap_stats'])
                self.diff_int_stats(elem_old_stats['qvb_stats'], elem_new_stats['qvb_stats'])
                self.diff_int_stats(elem_old_stats['qvo_stats'], elem_new_stats['qvo_stats'])

    def diff_elem_list_stats(self, list_old_stats, list_new_stats, type):
        for elem_new_stats in list_new_stats:
            elem_old_stats = self.locate_elem_list(list_old_stats, elem_new_stats['name'])
            if (elem_old_stats is not None):
                if type == 1:
                    self.diff_int_stats(elem_old_stats, elem_new_stats)
                elif type == 2:
                    self.diff_queue_stats(elem_old_stats, elem_new_stats)
                elif type == 3:
                    self.diff_vm_stats(elem_old_stats['vifs'], elem_new_stats['vifs'])
                else:
                    return None

    def calculate_metrics(self):
        old_servers_stats = self.old_results
        new_servers_stats = dict(self.new_results)

        for new_server_stats in new_servers_stats['servers']:
            old_server_stats = self.locate_elem_list(old_servers_stats['servers'], new_server_stats['name'])
            if (old_server_stats is not None):
                if (new_server_stats['timestamp'] > old_server_stats['timestamp']):
                    self.diff_time = round((new_server_stats['timestamp'] - old_server_stats['timestamp']),1)
                    #new_server_stats['diff_time'] = self.diff_time
                    new_server_stats['timestamp'] = new_server_stats['timestamp'] * 1000#time.strftime("%H:%M:%S", time.localtime(new_server_stats['timestamp']))
                    self.diff_elem_list_stats(old_server_stats["pifs"], new_server_stats["pifs"], 1)
                    self.diff_elem_list_stats(old_server_stats["tunifs"], new_server_stats["tunifs"], 1)
                    self.diff_elem_list_stats(old_server_stats["cpu_back_queue"], new_server_stats["cpu_back_queue"], 2)
                    self.diff_elem_list_stats(old_server_stats["virtual_machines"],new_server_stats["virtual_machines"], 3)
                else:
                    return None

        return new_servers_stats

    def get_stats(self):
        self.new_results = {'servers': []}
        if (self.nova is not None):
           for server in self.up_servers:
                if self.conn[server] is not None:
                    self.get_stats_from_server(server)
                else:
                    print("ERROR: The stats from server " + server + " cannot be recovered. It does not have a valid connection.")
                    self.add_down_server(server)

    def connect(self):
        self.connect_servers()
        self.create_session_nova()
        self.get_stats()
        self.old_results = dict(self.new_results)

    def start_get_metrics(self):
        self.try_connect_down_servers()
        response = {}
        self.get_stats()
        response = self.calculate_metrics()
        self.old_results = dict(self.new_results)
        self.current_metrics = response
        threading.Timer(5, self.start_get_metrics).start()

    def start_manager(self):
        if self.firstTime:
            self.connect()
            self.start_get_metrics()
            self.firstTime = False

    def collect(self):
        return self.current_metrics


#if __name__ == '__main__':
#    try:
#        print 'Use Control-C to exit'
#        manager = MiningManager()
#        manager.start_manager()
#        print manager.collect()
#    except KeyboardInterrupt:
#        print 'Exiting'