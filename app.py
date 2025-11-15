#!/usr/bin/env python3
"""
FastAPI Backend untuk Conntrack Dashboard
"""

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any
from datetime import datetime
import uvicorn
from conntrack_parser import ConntrackParser

app = FastAPI(title="Conntrack Dashboard API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

parser = ConntrackParser()


@app.get("/", response_class=HTMLResponse)
async def root():
    """Serve dashboard HTML"""
    try:
        return FileResponse("static/index.html")
    except FileNotFoundError:
        return HTMLResponse("""
        <html>
            <body>
                <h1>Dashboard tidak ditemukan</h1>
                <p>Pastikan file static/index.html ada</p>
            </body>
        </html>
        """)


@app.get("/api/connections")
async def get_connections() -> Dict[str, Any]:
    """Mendapatkan semua koneksi conntrack"""
    try:
        connections = parser.get_conntrack_data()
        if not connections:
            # Cek apakah ada masalah permission
            import os
            import subprocess
            try:
                test_result = subprocess.run(['conntrack', '-L'], capture_output=True, timeout=2, stderr=subprocess.PIPE)
                if test_result.returncode != 0 and 'root' in test_result.stderr.decode('utf-8', errors='ignore').lower():
                    return {
                        "success": False,
                        "data": [],
                        "count": 0,
                        "error": "Permission denied: conntrack memerlukan root access. Jalankan dengan sudo atau berikan CAP_NET_ADMIN capability."
                    }
            except:
                pass
            return {
                "success": True,
                "data": [],
                "count": 0,
                "message": "Tidak ada data conntrack yang ditemukan. Pastikan ada koneksi aktif atau jalankan dengan sudo."
            }
        return {
            "success": True,
            "data": connections,
            "count": len(connections)
        }
    except Exception as e:
        return {
            "success": False,
            "data": [],
            "count": 0,
            "error": f"Error membaca conntrack: {str(e)}"
        }


@app.get("/api/summary")
async def get_summary() -> Dict[str, Any]:
    """Mendapatkan ringkasan agregasi data conntrack"""
    try:
        connections = parser.get_conntrack_data()
        if not connections:
            # Cek apakah ada masalah permission
            import subprocess
            error_msg = "Tidak ada data conntrack yang ditemukan."
            try:
                test_result = subprocess.run(['conntrack', '-L'], capture_output=True, timeout=2, stderr=subprocess.PIPE)
                if test_result.returncode != 0 and 'root' in test_result.stderr.decode('utf-8', errors='ignore').lower():
                    error_msg = "Permission denied: conntrack memerlukan root access. Jalankan server dengan sudo atau berikan CAP_NET_ADMIN capability."
            except:
                pass
            
            return {
                "success": False,
                "data": {
                    "total_connections": 0,
                    "by_protocol": {},
                    "by_state": {},
                    "top_source_ips": [],
                    "top_destination_ips": [],
                    "top_destination_ports": [],
                    "top_source_ports": [],
                    "protocol_state_matrix": {},
                    "timestamp": datetime.now().isoformat(),
                    "error": error_msg
                }
            }
        summary = parser.get_connection_summary(connections)
        return {
            "success": True,
            "data": summary
        }
    except Exception as e:
        return {
            "success": False,
            "data": {
                "total_connections": 0,
                "error": f"Error memproses summary: {str(e)}",
                "timestamp": datetime.now().isoformat()
            }
        }


@app.get("/api/aggregate/protocol")
async def aggregate_by_protocol() -> Dict[str, Any]:
    """Agregasi berdasarkan protocol"""
    try:
        connections = parser.get_conntrack_data()
        result = parser.aggregate_by_protocol(connections)
        return {
            "success": True,
            "data": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@app.get("/api/aggregate/state")
async def aggregate_by_state() -> Dict[str, Any]:
    """Agregasi berdasarkan state"""
    try:
        connections = parser.get_conntrack_data()
        result = parser.aggregate_by_state(connections)
        return {
            "success": True,
            "data": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@app.get("/api/aggregate/source-ip")
async def aggregate_by_source_ip(top_n: int = 10) -> Dict[str, Any]:
    """Agregasi berdasarkan source IP"""
    try:
        connections = parser.get_conntrack_data()
        result = parser.aggregate_by_source_ip(connections, top_n)
        return {
            "success": True,
            "data": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@app.get("/api/aggregate/destination-ip")
async def aggregate_by_destination_ip(top_n: int = 10) -> Dict[str, Any]:
    """Agregasi berdasarkan destination IP"""
    try:
        connections = parser.get_conntrack_data()
        result = parser.aggregate_by_destination_ip(connections, top_n)
        return {
            "success": True,
            "data": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@app.get("/api/aggregate/ports")
async def aggregate_by_ports(port_type: str = "dport", top_n: int = 10) -> Dict[str, Any]:
    """Agregasi berdasarkan port"""
    try:
        connections = parser.get_conntrack_data()
        result = parser.aggregate_by_port(connections, port_type, top_n)
        return {
            "success": True,
            "data": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@app.get("/api/group/protocol-state")
async def group_by_protocol_state() -> Dict[str, Any]:
    """Grouping berdasarkan protocol dan state"""
    try:
        connections = parser.get_conntrack_data()
        result = parser.group_by_protocol_state(connections)
        return {
            "success": True,
            "data": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

