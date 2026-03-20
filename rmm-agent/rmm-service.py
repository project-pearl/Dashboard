#!/usr/bin/env python3
"""
RMM Agent Windows Service Wrapper
"""

import os
import sys
import time
import logging
import logging.handlers
import win32serviceutil
import win32service
import win32event
import servicemanager

# Add current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from rmm_agent import RMMAgent
except ImportError:
    # Fallback import
    import importlib.util
    spec = importlib.util.spec_from_file_location("rmm_agent", "rmm-agent.py")
    rmm_agent = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(rmm_agent)
    RMMAgent = rmm_agent.RMMAgent

class RMMAgentService(win32serviceutil.ServiceFramework):
    _svc_name_ = "RMMAgent"
    _svc_display_name_ = "RMM Agent"
    _svc_description_ = "Remote Monitoring and Management Agent"

    def __init__(self, args):
        win32serviceutil.ServiceFramework.__init__(self, args)
        self.hWaitStop = win32event.CreateEvent(None, 0, 0, None)
        self.is_alive = True

        # Set up logging
        log_dir = os.path.dirname(os.path.abspath(__file__))
        log_file = os.path.join(log_dir, 'rmm-agent.log')

        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.handlers.RotatingFileHandler(
                    log_file,
                    maxBytes=10*1024*1024,  # 10MB
                    backupCount=5
                )
            ]
        )
        self.logger = logging.getLogger('RMMAgent')

    def SvcStop(self):
        self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
        self.is_alive = False
        win32event.SetEvent(self.hWaitStop)
        self.logger.info("RMM Agent service stop requested")

    def SvcDoRun(self):
        self.logger.info("RMM Agent service starting...")
        servicemanager.LogMsg(
            servicemanager.EVENTLOG_INFORMATION_TYPE,
            servicemanager.PYS_SERVICE_STARTED,
            (self._svc_name_, '')
        )

        try:
            # Change to service directory
            service_dir = os.path.dirname(os.path.abspath(__file__))
            os.chdir(service_dir)

            # Initialize and run agent
            agent = RMMAgent("rmm-config.json")
            self.run_agent_loop(agent)

        except Exception as e:
            self.logger.error(f"RMM Agent service error: {e}")
            servicemanager.LogErrorMsg(f"RMM Agent error: {e}")

    def run_agent_loop(self, agent):
        """Run the agent loop with service control"""
        cycle_count = 0

        while self.is_alive:
            try:
                # Check if service stop was requested
                if win32event.WaitForSingleObject(self.hWaitStop, 0) == win32event.WAIT_OBJECT_0:
                    break

                # Regular collection cycle
                agent.run_collection_cycle()

                # Asset collection every 12 cycles (1 hour if 5min intervals)
                if cycle_count % 12 == 0:
                    agent.run_asset_collection()

                cycle_count += 1

                # Wait for poll interval or stop event
                wait_time = agent.config["poll_interval"] * 1000  # Convert to milliseconds
                if win32event.WaitForSingleObject(self.hWaitStop, wait_time) == win32event.WAIT_OBJECT_0:
                    break

            except Exception as e:
                self.logger.error(f"Error in agent loop: {e}")
                # Wait 1 minute before retrying
                if win32event.WaitForSingleObject(self.hWaitStop, 60000) == win32event.WAIT_OBJECT_0:
                    break

        self.logger.info("RMM Agent service stopped")

def main():
    if len(sys.argv) == 1:
        servicemanager.Initialize()
        servicemanager.PrepareToHostSingle(RMMAgentService)
        servicemanager.StartServiceCtrlDispatcher()
    else:
        win32serviceutil.HandleCommandLine(RMMAgentService)

if __name__ == '__main__':
    main()