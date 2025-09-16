// PPT 생성 관련 서비스 함수들

// 프레젠테이션 생성
export async function createPresentation(title, token) {
  const res = await fetch('https://slides.googleapis.com/v1/presentations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title })
  });

  const data = await res.json();
  console.log('Created presentation ID:', data.presentationId);
  return data.presentationId;
}

// 슬라이드 추가 (TITLE_AND_BODY)
export async function addSlide(presentationId, token) {
  await fetch(`https://slides.googleapis.com/v1/presentations/${presentationId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          createSlide: {
            slideLayoutReference: {
              predefinedLayout: 'TITLE_AND_BODY'
            }
          }
        }
      ]
    })
  });
}

// 첫 슬라이드를 TITLE_AND_BODY로 변환
export async function makeTitleAndBody(presId, slideId, token) {
  await fetch(`https://slides.googleapis.com/v1/presentations/${presId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          updatePageProperties: {
            objectId: slideId,
            pageProperties: { layoutProperties: { name: 'TITLE_AND_BODY' } },
            fields: 'pageProperties.layoutProperties'
          }
        }
      ]
    })
  });
}

// 프레젠테이션 데이터 가져오기
export async function getPresentationData(presentationId, token) {
  const res = await fetch(`https://slides.googleapis.com/v1/presentations/${presentationId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await res.json();
  console.log('Slides data:', data);
  return data;
}

// 요소 텍스트 업데이트
export async function updateElementText(presentationId, elementId, newText, token) {
  const requests = [
    {
      insertText: {
        objectId: elementId,
        insertionIndex: 0,
        text: newText
      }
    },
    {
      deleteText: {
        objectId: elementId,
        textRange: { type: 'ALL' }
      }
    },
    {
      insertText: {
        objectId: elementId,
        insertionIndex: 0,
        text: newText
      }
    }
  ];

  await fetch(`https://slides.googleapis.com/v1/presentations/${presentationId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ requests })
  });
}

// 스타일 변경을 위한 함수
export async function updateElementStyle(presentationId, elementId, styleObj, token) {
  const requests = [
    {
      updateTextStyle: {
        objectId: elementId,
        style: styleObj,
        fields: Object.keys(styleObj).join(','),
        textRange: { type: 'ALL' }
      }
    }
  ];

  await fetch(`https://slides.googleapis.com/v1/presentations/${presentationId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ requests })
  });
}

// 이미지를 슬라이드에 추가
export async function addImageToSlide(presentationId, slideId, imageUrl, token, position = { x: 0, y: 0, width: 300, height: 200 }) {
  try {
    const response = await fetch(`https://slides.googleapis.com/v1/presentations/${presentationId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            createImage: {
              objectId: `image_${Date.now()}`,
              url: imageUrl,
              elementProperties: {
                pageObjectId: slideId,
                size: {
                  width: {
                    magnitude: position.width,
                    unit: 'PT'
                  },
                  height: {
                    magnitude: position.height,
                    unit: 'PT'
                  }
                },
                transform: {
                  scaleX: 1,
                  scaleY: 1,
                  translateX: position.x,
                  translateY: position.y,
                  unit: 'PT'
                }
              }
            }
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('이미지 추가 오류:', errorData);
      throw new Error(`이미지 추가 실패: ${errorData.error?.message || '알 수 없는 오류'}`);
    }

    const result = await response.json();
    console.log('이미지가 성공적으로 추가되었습니다:', result);
    return result;
  } catch (error) {
    console.error('이미지 추가 중 오류 발생:', error);
    throw error;
  }
}

// API로 텍스트 수정하고 성공하면 로컬 slides 상태도 안전히 갱신하는 헬퍼
export async function updateElementTextAndLocal(pId, elementId, newText, token, setSlides) {
  await updateElementText(pId, elementId, newText, token);

  setSlides(prevSlides => {
    return prevSlides.map(slide => {
      if (!slide.pageElements) return slide;
      const hasEl = slide.pageElements.some(pe => pe.objectId === elementId);
      if (!hasEl) return slide;

      const newPageElements = slide.pageElements.map(pe => {
        if (pe.objectId !== elementId) return pe;
        const newShape = {
          ...pe.shape,
          text: {
            ...pe.shape?.text,
            textElements: [{ textRun: { content: newText } }]
          }
        };
        return { ...pe, shape: newShape };
      });

      return { ...slide, pageElements: newPageElements };
    });
  });
}

// 요소에서 텍스트 추출
export function getTextFromElement(el) {
  if (!el.shape || !el.shape.text || !el.shape.text.textElements) return '';
  return el.shape.text.textElements.map(te => te.textRun?.content || '').join('');
}

// PPTX 파일 다운로드
export async function downloadPptxFromDrive(presentationId, token) {
  const mime = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${presentationId}/export?mimeType=${encodeURIComponent(mime)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error('Export 실패: ' + text);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `presentation_${presentationId}.pptx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// 첫 번째 플레이스홀더 찾기
export function findFirstPlaceholder(shapeList, type /* 'TITLE' | 'BODY' */) {
  for (const el of shapeList) {
    if (el.shape && el.shape.placeholder && el.shape.placeholder.type === type) {
      return el.objectId;
    }
  }
  return null;
}

// 템플릿 선택 → 프레젠테이션 생성 + 이력 반영
export async function handleTemplateSelect(templateName, selectedExperiences, accessToken, authService, setPresentationId, setSlides, setSelectedTemplate, setActiveSection) {
  const title = prompt('슬라이드 제목을 입력하세요:', '나의 포트폴리오');
  if (!title) {
    alert('제목이 없습니다.');
    return;
  }

  // 토큰 확보 보장
  if (!accessToken) {
    try {
      const token = await authService.current.getAccessToken();
      return { accessToken: token };
    } catch (error) {
      console.error('토큰 가져오기 실패:', error);
      alert('인증이 필요합니다. 다시 로그인해주세요.');
      return;
    }
  }

  setSelectedTemplate(templateName);

  try {
    // 1) 프레젠테이션 생성
    const presId = await createPresentation(title, accessToken);
    setPresentationId(presId);

    // 2) 첫 슬라이드 레이아웃 보정
    let data = await getPresentationData(presId, accessToken);
    if (data.slides?.length > 0) {
      await makeTitleAndBody(presId, data.slides[0].objectId, accessToken);
    }

    // 3) 템플릿별 슬라이드 추가
    if (templateName === 'basic') {
      for (let i = 0; i < selectedExperiences.length; i++) {
        await addSlide(presId, accessToken);
      }
    } else if (templateName === 'timeline') {
      await addSlide(presId, accessToken);
      await addSlide(presId, accessToken);
      for (let i = 0; i < selectedExperiences.length; i++) {
        await addSlide(presId, accessToken);
      }
    } else if (templateName === 'grid') {
      await addSlide(presId, accessToken);
      await addSlide(presId, accessToken);
    }

    // 4) 최신 데이터 가져오기
    data = await getPresentationData(presId, accessToken);
    const slidesArr = data.slides || [];

    // 5) 텍스트 채우기
    if (slidesArr[0]) {
      const s0 = slidesArr[0];
      const titleShapeId = findFirstPlaceholder(s0.pageElements, 'TITLE');
      const bodyShapeId  = findFirstPlaceholder(s0.pageElements, 'BODY');

      if (titleShapeId) await updateElementText(presId, titleShapeId, title, accessToken);
      if (bodyShapeId) {
        const firstTwo = selectedExperiences
            .slice(0, 2)
            .map(e => `• ${e.title} (${e.period})`)
            .join('\n');
        await updateElementText(presId, bodyShapeId, firstTwo || '포트폴리오', accessToken);
      }
    }

    let idx = 1;
    for (const exp of selectedExperiences) {
      if (!slidesArr[idx]) break;
      const s = slidesArr[idx];
      const titleShapeId = findFirstPlaceholder(s.pageElements, 'TITLE');
      const bodyShapeId  = findFirstPlaceholder(s.pageElements, 'BODY');

      if (titleShapeId) await updateElementText(presId, titleShapeId, exp.title, accessToken);
      if (bodyShapeId)  await updateElementText(presId, bodyShapeId, `${exp.period}\n\n${exp.description}`, accessToken);
      
      // 이미지가 있는 경우 슬라이드에 추가
      if (exp.imageUrls && exp.imageUrls.length > 0) {
        try {
          // 모든 이미지를 추가 (세로로 일렬 배치)
          const imageCount = exp.imageUrls.length;
          const imageWidth = 250;
          const imageHeight = 150;
          const imageSpacing = 20;
          const startX = 400; // 텍스트 영역 오른쪽
          const startY = 100; // 상단에서 100pt
          
          for (let i = 0; i < imageCount; i++) {
            const imageUrl = exp.imageUrls[i];
            
            // 이미지 위치 계산 (세로로 일렬 배치)
            const imagePosition = {
              x: startX,
              y: startY + i * (imageHeight + imageSpacing),
              width: imageWidth,
              height: imageHeight
            };
            
            await addImageToSlide(presId, s.objectId, imageUrl, accessToken, imagePosition);
            console.log(`이미지 ${i + 1}/${imageCount}가 슬라이드 ${idx}에 추가되었습니다:`, imageUrl);
          }
        } catch (imageError) {
          console.error(`슬라이드 ${idx}에 이미지 추가 실패:`, imageError);
          // 이미지 추가 실패해도 PPT 생성은 계속 진행
        }
      }
      
      idx++;
    }

    // 6) 최종 상태 반영
    const refreshed = await getPresentationData(presId, accessToken);
    setSlides(refreshed.slides || []);
    alert('PPT가 생성되었습니다.');
    setActiveSection('editor');
  } catch (error) {
    console.error('PPT 생성 오류:', error);
    alert('PPT 생성에 실패했습니다: ' + (error?.message || error));
  }
}
