import React, { useEffect, useState } from 'react';
import GoogleDriveService from '../services/googleDriveService';
import GoogleAuthService from '../services/googleAuthService';

function GoogleDriveTab() {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [authService] = useState(new GoogleAuthService());
    const [driveService, setDriveService] = useState(null);

    // 인증 및 서비스 초기화
    useEffect(() => {
        const initializeServices = async () => {
            try {
                setLoading(true);

                // 통합 인증 시스템 초기화
                await authService.initialize();

                // 드라이브 서비스 인스턴스 생성
                const newDriveService = new GoogleDriveService(authService);
                setDriveService(newDriveService);

                // 파일 목록 로드
                await fetchFiles(newDriveService);

            } catch (err) {
                setError('인증 초기화에 실패했습니다: ' + (err?.message || err));
            } finally {
                setLoading(false);
            }
        };

        initializeServices();
    }, [authService]);

    const fetchFiles = async (service = driveService) => {
        if (!service) return;

        setLoading(true);
        setError('');
        try {
            const fileList = await service.listFiles(20);
            setFiles(fileList);
        } catch (err) {
            setError(service.formatErrorMessage(err));
        }
        setLoading(false);
    };

    return (
        <div style={{ padding: '20px' }}>
            <h2>구글 드라이브 파일 목록</h2>
            {loading && <p>불러오는 중...</p>}
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <ul>
                {files.map((file) => (
                    <li key={file.id}>
                        <strong>{file.name}</strong> ({file.mimeType})<br />
                        생성일: {file.createdTime}<br />
                        수정일: {file.modifiedTime}<br />
                        크기: {file.size ? file.size + ' bytes' : '폴더 또는 알 수 없음'}
                    </li>
                ))}
            </ul>
            {files.length === 0 && !loading && !error && <p>표시할 파일이 없습니다.</p>}
        </div>
    );
}

export default GoogleDriveTab;