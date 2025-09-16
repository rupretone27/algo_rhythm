import React, { useState, useRef } from 'react';
import GoogleSheetsService from './services/googleSheetsService';
import GoogleDriveService from './services/googleDriveService';
import GoogleAuthService from './services/googleAuthService';

function useGoogleSheetTab({
  // Props from App.js
  experiences,
  setExperiences,
  selected,
  setSelected,
  isLoggedIn,
  setIsLoggedIn,
  authService,
  driveService,
  portfolioFolderId,
  setPortfolioFolderId,
  loadDriveFiles,
  preloadImage,
  formatPeriod,
  validateDates,
  uploadImageToDrive,
  selectAllExperiences,
  closeModal,
  form,
  setForm,
  selectedImages,
  setSelectedImages
}) {
  // 구글 시트 관련 상태 변수들
  const [spreadsheetId, setSpreadsheetId] = useState(() => {
    // localStorage에서 스프레드시트 ID 복원
    return localStorage.getItem('spreadsheetId') || null;
  });
  const [isSheetsInitialized, setIsSheetsInitialized] = useState(false);
  const [isSheetLoading, setIsSheetLoading] = useState(false);
  const [isExperienceLoading, setIsExperienceLoading] = useState(false);

  // 구글 시트 서비스 인스턴스
  const sheetsService = useRef(null);

  // 시트에서 이력 데이터 로드
  async function loadExperiencesFromSheets(spreadsheetIdToUse = null) {
    const targetSpreadsheetId = spreadsheetIdToUse || spreadsheetId;

    if (!targetSpreadsheetId || !sheetsService.current) return;

    try {
      const sheetData = await sheetsService.current.readData(targetSpreadsheetId, 'A:E');
      const experiences = sheetsService.current.formatSheetToExperience(sheetData);
      setExperiences(experiences);
      
      // 이미지 프리로딩 (백그라운드에서 미리 로딩)
      experiences.forEach(exp => {
        if (exp.imageUrls && exp.imageUrls.length > 0) {
          exp.imageUrls.forEach(imageUrl => {
            preloadImage(imageUrl).catch(err => {
              console.log('이미지 프리로딩 실패 (무시됨):', imageUrl, err);
            });
          });
        }
      });
    } catch (error) {
      console.error('이력 데이터 로드 오류:', error);
      // 시트가 존재하지 않는 경우 로그만 출력하고 새로 생성하지 않음
      if (error.message.includes('찾을 수 없습니다') || error.status === 404) {
        console.log('시트가 존재하지 않습니다. 시트를 다시 생성해주세요.');
        // 사용자에게 알림
        alert('포트폴리오 시트가 삭제되었습니다. 로그아웃 후 다시 로그인해주세요.');
      }
    }
  }

  // 구글 시트 데이터 새로고침
  async function refreshSheetsData() {
    try {
      setIsExperienceLoading(true);
      await loadExperiencesFromSheets();
      alert('구글 시트 데이터가 새로고침되었습니다!');
    } catch (error) {
      console.error('시트 데이터 새로고침 오류:', error);
      alert('데이터 새로고침에 실패했습니다: ' + (error?.message || error));
    } finally {
      setIsExperienceLoading(false);
    }
  }

  // 시트 생성
  async function createSheet() {
    if (!sheetsService.current || !driveService.current) return;

    try {
      setIsSheetLoading(true);

      // 포트폴리오 이력 폴더 생성 또는 찾기
      const portfolioFolder = await driveService.current.ensurePortfolioFolder();
      setPortfolioFolderId(portfolioFolder.id);
      localStorage.setItem('portfolioFolderId', portfolioFolder.id);

      // 이미지 폴더도 생성
      await driveService.current.ensureImageFolder(portfolioFolder.id);

      // 시트 생성
      const spreadsheet = await sheetsService.current.createSpreadsheet('포트폴리오 이력', portfolioFolder.id);
      const newSpreadsheetId = spreadsheet.spreadsheetId;

      // 상태 업데이트
      setSpreadsheetId(newSpreadsheetId);
      localStorage.setItem('spreadsheetId', newSpreadsheetId);

      // 헤더 설정
      await sheetsService.current.setupHeaders(newSpreadsheetId);

      // 파일 목록 새로고침
      await loadDriveFiles();

      alert('포트폴리오 시트와 폴더가 생성되었습니다!');
    } catch (error) {
      console.error('시트 생성 오류:', error);
      alert('시트 생성에 실패했습니다: ' + (error?.message || error));
    } finally {
      setIsSheetLoading(false);
    }
  }

  // 시트 삭제
  async function deleteSheet() {
    if (!spreadsheetId || !driveService.current) return;

    if (!window.confirm('포트폴리오 시트와 포트폴리오 이력 폴더를 모두 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;

    try {
      setIsSheetLoading(true);

      // 시트 파일 삭제
      await driveService.current.deleteFile(spreadsheetId);

      // 포트폴리오 이력 폴더도 삭제
      if (portfolioFolderId) {
        try {
          await driveService.current.deleteFile(portfolioFolderId);
          console.log('포트폴리오 이력 폴더도 삭제됨');
        } catch (folderError) {
          console.warn('포트폴리오 폴더 삭제 실패:', folderError);
        }
      }

      // 상태 초기화
      setSpreadsheetId(null);
      localStorage.removeItem('spreadsheetId');
      setPortfolioFolderId(null);
      localStorage.removeItem('portfolioFolderId');
      setExperiences([]);

      // 파일 목록 새로고침
      await loadDriveFiles();

      alert('포트폴리오 시트와 폴더가 삭제되었습니다!');
    } catch (error) {
      console.error('시트 삭제 오류:', error);
      alert('시트 삭제에 실패했습니다: ' + (error?.message || error));
    } finally {
      setIsSheetLoading(false);
    }
  }

  // 이력 저장
  async function saveExperience(e) {
    e.preventDefault();
    if (form.title && form.startDate && form.endDate && form.description) {
      // 날짜 유효성 검사
      if (!validateDates(form.startDate, form.endDate)) {
        return;
      }

      try
      {
        setIsExperienceLoading(true);

        let imageUrls = [];

        // 이미지들이 선택된 경우 구글 드라이브에 업로드
        if (selectedImages.length > 0) {
          for (const imageFile of selectedImages) {
            const imageUrl = await uploadImageToDrive(imageFile, form.title);
            imageUrls.push(imageUrl);
          }
        }

        // 기간 포맷팅
        const period = formatPeriod(form.startDate, form.endDate);

        // 로컬 상태 업데이트 (기간 포함)
        const newExperience = {
          ...form,
          period, // 포맷팅된 기간 추가
          imageUrls
        };
        setExperiences([...experiences, newExperience]);

        // 구글 시트에 저장
        if (spreadsheetId && sheetsService.current) {
          const sheetData = sheetsService.current.formatExperienceForSheet(newExperience);
          await sheetsService.current.appendData(spreadsheetId, 'A:E', [sheetData]);
        }

        closeModal();
      }catch (error) {
        console.error('이력 저장 오류:', error);
        const errorMessage = sheetsService.current?.formatErrorMessage(error) || '이력 저장에 실패했습니다.';
        alert(errorMessage);
      } finally {
        setIsExperienceLoading(false);
      }
    }
  }

  // 선택된 이력 삭제
  async function deleteSelectedExperiences() {
    if (selected.length === 0 || !sheetsService.current) return;

    if (!window.confirm('선택된 이력을 삭제하시겠습니까?')) return;

    try {
      setIsExperienceLoading(true);

      // 선택된 이력들을 구글 시트에서 삭제
      if (spreadsheetId && isSheetsInitialized) {
        // 선택된 행들을 역순으로 정렬하여 삭제 (인덱스가 변경되지 않도록)
        const sortedSelected = [...selected].sort((a, b) => b - a);

        for (const index of sortedSelected) {
          // 헤더 + 선택된 인덱스 + 1 (시트는 1부터 시작)
          const rowNumber = index + 2;
          await sheetsService.current.deleteData(spreadsheetId, `A${rowNumber}:E${rowNumber}`);
        }
      }

      // 로컬 상태에서도 삭제
      const newExperiences = experiences.filter((_, idx) => !selected.includes(idx));
      setExperiences(newExperiences);
      setSelected([]);

    } catch (error) {
      console.error('이력 삭제 오류:', error);
      const errorMessage = sheetsService.current?.formatErrorMessage(error) || '이력 삭제에 실패했습니다.';
      alert(errorMessage);
    } finally {
      setIsExperienceLoading(false);
    }
  }

  // 로그인 상태 저장
  function saveLoginState(loggedIn, spreadsheetIdValue = null) {
    setIsLoggedIn(loggedIn);
    localStorage.setItem('isLoggedIn', loggedIn.toString());

    if (spreadsheetIdValue) {
      setSpreadsheetId(spreadsheetIdValue);
      localStorage.setItem('spreadsheetId', spreadsheetIdValue);
    }

    // 로그아웃 시에는 스프레드시트 ID도 제거
    if (!loggedIn) {
      localStorage.removeItem('spreadsheetId');
      setSpreadsheetId(null);
    }
  }

  // 서비스 초기화
  async function initializeSheetsService() {
    if (!authService.current) return;

    try {
      // 서비스 인스턴스 생성 (의존성 주입)
      sheetsService.current = new GoogleSheetsService(authService.current);

      // 기존 스프레드시트가 있는지 확인하고 없으면 생성
      let currentSpreadsheetId = spreadsheetId;

      if (currentSpreadsheetId) {
        console.log('기존 스프레드시트 ID 확인 중:', currentSpreadsheetId);

        try {
          // 기존 시트가 실제로 존재하는지 확인
          const exists = await sheetsService.current.checkSpreadsheetExists(currentSpreadsheetId);
          if (!exists) {
            console.log('기존 스프레드시트가 존재하지 않습니다. 상태를 초기화합니다...');
            currentSpreadsheetId = null;
            setSpreadsheetId(null);
            localStorage.removeItem('spreadsheetId');
          } else {
            console.log('기존 스프레드시트가 유효합니다.');
          }
        } catch (error) {
          console.log('기존 스프레드시트 확인 중 오류, 상태를 초기화합니다:', error);
          currentSpreadsheetId = null;
          setSpreadsheetId(null);
          localStorage.removeItem('spreadsheetId');
        }
      }

      // 스프레드시트가 없으면 새로 생성
      if (!currentSpreadsheetId) {
        console.log('새 스프레드시트 생성 중...');
        
        // 포트폴리오 이력 폴더 생성 또는 찾기
        const portfolioFolder = await driveService.current.ensurePortfolioFolder();
        setPortfolioFolderId(portfolioFolder.id);
        localStorage.setItem('portfolioFolderId', portfolioFolder.id);

        // 이미지 폴더도 생성
        await driveService.current.ensureImageFolder(portfolioFolder.id);

        // 기존 포트폴리오 파일이 있는지 확인
        const existingFiles = await driveService.current.listFiles(50, portfolioFolder.id);
        const portfolioFile = existingFiles.find(file => 
          file.name === '포트폴리오 이력' && 
          file.mimeType === 'application/vnd.google-apps.spreadsheet'
        );

        if (portfolioFile) {
          console.log('기존 포트폴리오 파일 발견:', portfolioFile.name);
          
          // 기존 파일 ID 저장
          currentSpreadsheetId = portfolioFile.id;
          setSpreadsheetId(currentSpreadsheetId);
          localStorage.setItem('spreadsheetId', currentSpreadsheetId);

          // 포트폴리오 폴더 ID 설정
          setPortfolioFolderId(portfolioFolder.id);
          localStorage.setItem('portfolioFolderId', portfolioFolder.id);
        } else {
          // 새 스프레드시트 생성
          const spreadsheet = await sheetsService.current.createSpreadsheet('포트폴리오 이력', portfolioFolder.id);
          currentSpreadsheetId = spreadsheet.spreadsheetId;
          setSpreadsheetId(currentSpreadsheetId);
          localStorage.setItem('spreadsheetId', currentSpreadsheetId);

          // 헤더 설정
          await sheetsService.current.setupHeaders(currentSpreadsheetId);
        }
      }

      // 서비스 초기화 상태 설정
      setIsSheetsInitialized(true);

      // 기존 데이터 로드 (시트 생성 후에만 실행)
      if (currentSpreadsheetId) {
        // 시트 ID 상태를 먼저 업데이트
        setSpreadsheetId(currentSpreadsheetId);

        // 새로 생성된 시트에서 데이터 로드
        await loadExperiencesFromSheets(currentSpreadsheetId);
        await loadDriveFiles();
      }

      console.log('구글 시트 서비스 초기화 완료');

    } catch (error) {
      console.error('구글 시트 서비스 초기화 오류:', error);
      const errorMessage = error?.message || '구글 시트 서비스 초기화에 실패했습니다.';
      alert(errorMessage);
      setIsSheetsInitialized(false);
    }
  }

  // 드라이브 파일 로드 시 시트 존재 확인
  async function checkSheetExists() {
    if (spreadsheetId && sheetsService.current) {
      try {
        const exists = await sheetsService.current.checkSpreadsheetExists(spreadsheetId);
        if (!exists) {
          console.log('저장된 시트가 존재하지 않습니다. 상태를 초기화합니다.');
          setSpreadsheetId(null);
          localStorage.removeItem('spreadsheetId');
        }
      } catch (error) {
        console.log('시트 존재 확인 중 오류:', error);
        setSpreadsheetId(null);
        localStorage.removeItem('spreadsheetId');
      }
    }
  }

  // 서비스 정리
  function cleanupSheetsService() {
    sheetsService.current = null;
    setIsSheetsInitialized(false);
  }

  // 외부에서 사용할 수 있는 함수들과 상태들을 반환
  return {
    // 상태
    spreadsheetId,
    isSheetsInitialized,
    isSheetLoading,
    isExperienceLoading,
    
    // 함수들
    loadExperiencesFromSheets,
    refreshSheetsData,
    createSheet,
    deleteSheet,
    saveExperience,
    deleteSelectedExperiences,
    saveLoginState,
    initializeSheetsService,
    checkSheetExists,
    cleanupSheetsService
  };
}

export default useGoogleSheetTab;
