// Wait for libraries to load
function waitForLibraries() {
  return new Promise((resolve) => {
    const checkLibraries = () => {
      if (window.pdfjsLib && (window.PDFLib || window.pdfLib)) {
        // Set up PDF.js worker
        if (window.pdfjsLib) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
        }
        resolve()
      } else {
        setTimeout(checkLibraries, 50)
      }
    }
    checkLibraries()
  })
}

// Get PDFLib reference
function getPDFLib() {
  if (window.PDFLib) return window.PDFLib
  if (window.pdfLib) return window.pdfLib
  throw new Error('PDFLib is not loaded. Please check the CDN link.')
}

// Utility Functions
function downloadFile(data, filename) {
  let blob
  let url

  try {
    if (data instanceof Uint8Array) {
      blob = new Blob([data], { type: 'application/pdf' })
    } else {
      blob = data
    }

    url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    setTimeout(() => {
      URL.revokeObjectURL(url)
    }, 100)
  } catch (error) {
    console.error('Error downloading file:', error)
    throw new Error('Failed to download file')
  }
}

function createDownloadButton(data, filename, containerId) {
  const container = document.getElementById(containerId)
  if (!container) return

  let blob
  try {
    if (data instanceof Uint8Array) {
      blob = new Blob([data], { type: 'application/pdf' })
    } else {
      blob = data
    }

    const url = URL.createObjectURL(blob)
    
    // Remove any existing download button
    const existingBtn = container.querySelector('.download-btn')
    if (existingBtn) {
      existingBtn.remove()
    }
    
    const downloadBtn = document.createElement('button')
    downloadBtn.className = 'btn-primary download-btn'
    downloadBtn.innerHTML = `📥 Download ${filename}`
    downloadBtn.style.marginTop = '1rem'
    downloadBtn.style.width = '100%'
    
    downloadBtn.addEventListener('click', () => {
      try {
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        link.style.display = 'none'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        // Revoke object URL after a delay to ensure download starts
        setTimeout(() => {
          URL.revokeObjectURL(url)
        }, 200)
      } catch (error) {
        console.error('Error triggering download:', error)
        // Fallback: try opening in new window
        window.open(url, '_blank')
      }
    })

    // Append button to container (after existing content)
    container.appendChild(downloadBtn)
  } catch (error) {
    console.error('Error creating download button:', error)
  }
}

async function mergePdf(pdfFiles) {
  try {
    const PDFLib = getPDFLib()
    const mergedPdf = await PDFLib.PDFDocument.create()

    for (const file of pdfFiles) {
      const arrayBuffer = await file.arrayBuffer()
      const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer)
      const pages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices())
      
      pages.forEach((page) => {
        mergedPdf.addPage(page)
      })
    }

    const pdfBytes = await mergedPdf.save()
    return pdfBytes
  } catch (error) {
    console.error('Error merging PDFs:', error)
    throw new Error('Failed to merge PDFs. Please ensure all files are valid PDF documents.')
  }
}

async function splitPdf(pdfFile, startPage, endPage) {
  try {
    const PDFLib = getPDFLib()
    const arrayBuffer = await pdfFile.arrayBuffer()
    const sourcePdf = await PDFLib.PDFDocument.load(arrayBuffer)
    const totalPages = sourcePdf.getPageCount()

    if (startPage < 1 || endPage > totalPages || startPage > endPage) {
      throw new Error(`Invalid page range. PDF has ${totalPages} page(s).`)
    }

    const splitPdf = await PDFLib.PDFDocument.create()
    const pageIndices = []
    
    for (let i = startPage - 1; i < endPage; i++) {
      pageIndices.push(i)
    }

    const pages = await splitPdf.copyPages(sourcePdf, pageIndices)
    pages.forEach((page) => {
      splitPdf.addPage(page)
    })

    const pdfBytes = await splitPdf.save()
    return pdfBytes
  } catch (error) {
    console.error('Error splitting PDF:', error)
    if (error.message.includes('Invalid page range')) {
      throw error
    }
    throw new Error('Failed to split PDF. Please ensure the file is a valid PDF document.')
  }
}


async function compressPdf(pdfFile) {
  try {
    const PDFLib = getPDFLib()
    const arrayBuffer = await pdfFile.arrayBuffer()
    const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer)

    const pdfBytes = await pdfDoc.save({
      useObjectStreams: false,
      addDefaultPage: false,
    })
    
    return pdfBytes
  } catch (error) {
    console.error('Error compressing PDF:', error)
    throw new Error('Failed to compress PDF. Please ensure the file is a valid PDF document.')
  }
}

async function imageToPdf(imageFiles) {
  try {
    const PDFLib = getPDFLib()
    const pdfDoc = await PDFLib.PDFDocument.create()
    const files = Array.isArray(imageFiles) ? imageFiles : [imageFiles]

    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer()
      
      let image
      if (file.type === 'image/png') {
        image = await pdfDoc.embedPng(arrayBuffer)
      } else if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
        image = await pdfDoc.embedJpg(arrayBuffer)
      } else {
        try {
          image = await pdfDoc.embedPng(arrayBuffer)
        } catch {
          image = await pdfDoc.embedJpg(arrayBuffer)
        }
      }

      const { width, height } = image.scale(1)
      const page = pdfDoc.addPage([width, height])
      page.drawImage(image, {
        x: 0,
        y: 0,
        width: width,
        height: height,
      })
    }

    const pdfBytes = await pdfDoc.save()
    return pdfBytes
  } catch (error) {
    console.error('Error converting image to PDF:', error)
    throw new Error('Failed to convert image to PDF. Please ensure the file is a valid image.')
  }
}

// Router
const routes = {
  '/': 'page-home',
  '/pdf-tools': 'page-pdf-tools',
  '/merge-pdf': 'page-merge-pdf',
  '/split-pdf': 'page-split-pdf',
  '/compress-pdf': 'page-compress-pdf',
  '/pdf-to-image': 'page-pdf-to-image',
  '/image-to-pdf': 'page-image-to-pdf',
}

function navigateTo(route) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(page => {
    page.classList.add('hidden')
  })

  // Show target page
  const pageId = routes[route] || routes['/']
  const targetPage = document.getElementById(pageId)
  if (targetPage) {
    targetPage.classList.remove('hidden')
  }

  // Update active nav link
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active')
    const linkRoute = link.getAttribute('data-route')
    if (linkRoute === route) {
      link.classList.add('active')
    }
    // Also mark PDF Tools as active if on any PDF tool page
    if (linkRoute === '/pdf-tools' && (
      route === '/merge-pdf' || route === '/split-pdf' || 
      route === '/compress-pdf' || route === '/pdf-to-image' || 
      route === '/image-to-pdf'
    )) {
      link.classList.add('active')
    }
  })

  // Update URL without reload
  window.history.pushState({ route }, '', route)
}

// Initialize router
document.addEventListener('DOMContentLoaded', async () => {
  // Wait for libraries to load
  await waitForLibraries()
  
  // Set current year
  const yearElement = document.getElementById('current-year')
  if (yearElement) {
    yearElement.textContent = new Date().getFullYear()
  }

  // Handle route clicks
  document.querySelectorAll('[data-route]').forEach(element => {
    element.addEventListener('click', (e) => {
      e.preventDefault()
      const route = element.getAttribute('data-route')
      navigateTo(route)
    })
  })

  // Handle browser back/forward
  window.addEventListener('popstate', (e) => {
    const route = window.location.pathname || '/'
    navigateTo(route)
  })

  // Initial route
  const initialRoute = window.location.pathname || '/'
  navigateTo(initialRoute)

  // Initialize all page functionality
  initMergePdf()
  initSplitPdf()
  initCompressPdf()
  initPdfToImage()
  initImageToPdf()
})

// Dropzone Component
function createDropzone(containerId, options = {}) {
  const container = document.getElementById(containerId)
  if (!container) return null

  const {
    accept = '',
    multiple = false,
    onFilesSelected = null,
    maxFiles = null
  } = options

  let isDragging = false
  const fileInput = document.createElement('input')
  fileInput.type = 'file'
  fileInput.accept = accept
  fileInput.multiple = multiple
  fileInput.style.display = 'none'

  function validateFiles(files) {
    const fileArray = Array.from(files)
    
    if (!multiple && fileArray.length > 1) {
      showError(container, 'Please select only one file')
      return false
    }

    if (maxFiles && fileArray.length > maxFiles) {
      showError(container, `Maximum ${maxFiles} file(s) allowed`)
      return false
    }

    if (accept) {
      const acceptedTypes = accept.split(',').map(type => type.trim())
      const isValid = fileArray.every(file => {
        return acceptedTypes.some(type => {
          if (type.startsWith('.')) {
            return file.name.toLowerCase().endsWith(type.toLowerCase())
          }
          if (type === 'image/*') {
            return file.type.startsWith('image/')
          }
          return file.type.match(type.replace('*', '.*'))
        })
      })

      if (!isValid) {
        showError(container, `Please select files with the following types: ${accept}`)
        return false
      }
    }

    clearError(container)
    return true
  }

  function handleFiles(files) {
    if (!files || files.length === 0) return

    if (validateFiles(files)) {
      if (onFilesSelected) {
        onFilesSelected(multiple ? Array.from(files) : files[0])
      }
    }
  }

  function showError(container, message) {
    let errorDiv = container.parentElement.querySelector('.dropzone-error')
    if (!errorDiv) {
      errorDiv = document.createElement('div')
      errorDiv.className = 'dropzone-error error-message'
      container.parentElement.insertBefore(errorDiv, container.nextSibling)
    }
    errorDiv.textContent = message
    errorDiv.classList.remove('hidden')
  }

  function clearError(container) {
    const errorDiv = container.parentElement.querySelector('.dropzone-error')
    if (errorDiv) {
      errorDiv.classList.add('hidden')
    }
  }

  container.innerHTML = ''
  container.appendChild(fileInput)

  const dropzoneContent = document.createElement('div')
  dropzoneContent.className = 'dropzone-content'
  
  dropzoneContent.innerHTML = `
    <svg class="dropzone-icon" fill="none" viewBox="0 0 48 48" stroke="currentColor">
      <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <div class="dropzone-text">
      <span class="font-semibold text-blue-600 hover:text-blue-700">Click to upload</span>
      or drag and drop
    </div>
    ${accept ? `<p class="dropzone-format">${accept.includes(',') ? 'Formats' : 'Format'}: ${accept}</p>` : ''}
    ${multiple ? `<p class="dropzone-format">${maxFiles ? `Up to ${maxFiles} files` : 'Multiple files allowed'}</p>` : ''}
  `

  container.appendChild(dropzoneContent)

  container.addEventListener('click', () => fileInput.click())
  container.addEventListener('dragenter', (e) => {
    e.preventDefault()
    e.stopPropagation()
    isDragging = true
    container.classList.add('dragging')
  })
  container.addEventListener('dragleave', (e) => {
    e.preventDefault()
    e.stopPropagation()
    isDragging = false
    container.classList.remove('dragging')
  })
  container.addEventListener('dragover', (e) => {
    e.preventDefault()
    e.stopPropagation()
  })
  container.addEventListener('drop', (e) => {
    e.preventDefault()
    e.stopPropagation()
    isDragging = false
    container.classList.remove('dragging')
    handleFiles(e.dataTransfer.files)
  })
  fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files)
    // Reset input so same file can be selected again
    e.target.value = ''
  })

  return { fileInput, clearError: () => clearError(container) }
}

// PDF Preview Component
function createPdfPreview(containerId, file, onPageChange = null) {
  const container = document.getElementById(containerId)
  if (!container) return null

  let pdfDoc = null
  let currentPage = 1
  let totalPages = 0
  const canvas = document.createElement('canvas')

  async function loadPdf() {
    try {
      if (!window.pdfjsLib) {
        throw new Error('PDF.js library is not loaded')
      }
      
      container.innerHTML = '<div class="text-center p-8"><div class="loader loader-md inline-block mb-2"></div><p class="text-gray-600">Loading PDF...</p></div>'
      
      const arrayBuffer = await file.arrayBuffer()
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
      pdfDoc = await loadingTask.promise
      totalPages = pdfDoc.numPages
      currentPage = 1
      
      await renderPage()
    } catch (err) {
      console.error('Error loading PDF:', err)
      container.innerHTML = '<div class="error-message">Failed to load PDF. Please ensure it is a valid PDF file.</div>'
    }
  }

  async function renderPage() {
    if (!pdfDoc) return

    try {
      const page = await pdfDoc.getPage(currentPage)
      const viewport = page.getViewport({ scale: 1.5 })
      
      canvas.height = viewport.height
      canvas.width = viewport.width

      const context = canvas.getContext('2d')
      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise

      const navDiv = document.createElement('div')
      navDiv.className = 'pdf-nav'
      navDiv.innerHTML = `
        <button class="prev-btn" ${currentPage <= 1 ? 'disabled' : ''}>Previous</button>
        <span class="pdf-page-info">Page ${currentPage} of ${totalPages}</span>
        <button class="next-btn" ${currentPage >= totalPages ? 'disabled' : ''}>Next</button>
      `

      const canvasContainer = document.createElement('div')
      canvasContainer.className = 'pdf-canvas-container'
      canvasContainer.appendChild(canvas)

      const previewContainer = document.createElement('div')
      previewContainer.className = 'pdf-preview-container'
      previewContainer.appendChild(navDiv)
      previewContainer.appendChild(canvasContainer)

      container.innerHTML = ''
      container.appendChild(previewContainer)

      navDiv.querySelector('.prev-btn').addEventListener('click', () => {
        if (currentPage > 1) {
          currentPage--
          renderPage()
          if (onPageChange) onPageChange(currentPage)
        }
      })

      navDiv.querySelector('.next-btn').addEventListener('click', () => {
        if (currentPage < totalPages) {
          currentPage++
          renderPage()
          if (onPageChange) onPageChange(currentPage)
        }
      })
    } catch (err) {
      console.error('Error rendering page:', err)
      container.innerHTML = '<div class="error-message">Failed to render PDF page.</div>'
    }
  }

  loadPdf()

  return {
    goToPage: (page) => {
      if (page >= 1 && page <= totalPages) {
        currentPage = page
        renderPage()
        if (onPageChange) onPageChange(currentPage)
      }
    },
    getCurrentPage: () => currentPage
  }
}

// Image Preview Component
function createImagePreview(containerId, files) {
  const container = document.getElementById(containerId)
  if (!container) return null

  const filesArray = Array.isArray(files) ? files : [files]
  
  if (filesArray.length === 0) {
    container.innerHTML = '<div class="preview-placeholder">Upload images to see preview</div>'
    return
  }

  const previewContainer = document.createElement('div')
  previewContainer.className = 'image-preview-container'

  filesArray.forEach((file, index) => {
    const url = URL.createObjectURL(file)
    const itemDiv = document.createElement('div')
    itemDiv.className = 'image-preview-item'
    itemDiv.innerHTML = `
      <p class="image-preview-name">${file.name}</p>
      <img src="${url}" alt="${file.name}" />
    `
    previewContainer.appendChild(itemDiv)
  })

  container.innerHTML = ''
  container.appendChild(previewContainer)
}

// Merge PDF Page
function initMergePdf() {
  let pdfFile1 = null
  let pdfFile2 = null

  // Create first dropzone
  createDropzone('merge-dropzone-1', {
    accept: '.pdf,application/pdf',
    multiple: false,
    onFilesSelected: (file) => {
      pdfFile1 = file
      updateFileInfo(1, file)
      updateMergeButton()
      clearMessages()
    }
  })

  // Create second dropzone
  createDropzone('merge-dropzone-2', {
    accept: '.pdf,application/pdf',
    multiple: false,
    onFilesSelected: (file) => {
      pdfFile2 = file
      updateFileInfo(2, file)
      updateMergeButton()
      clearMessages()
    }
  })

  function updateFileInfo(fileNumber, file) {
    const infoDiv = document.getElementById(`merge-file-${fileNumber}-info`)
    if (file) {
      infoDiv.classList.remove('hidden')
      infoDiv.innerHTML = `
        <span>📄</span>
        <span>${file.name} (${(file.size / 1024).toFixed(2)} KB)</span>
      `
    } else {
      infoDiv.classList.add('hidden')
    }
  }

  function updateMergeButton() {
    const btn = document.getElementById('merge-btn')
    btn.disabled = !pdfFile1 || !pdfFile2
  }

  function showError(message) {
    const errorDiv = document.getElementById('merge-error')
    errorDiv.textContent = message
    errorDiv.classList.remove('hidden')
  }

  function showSuccess(message) {
    const successDiv = document.getElementById('merge-success')
    const existingBtn = successDiv.querySelector('.download-btn')
    successDiv.innerHTML = `<p>${message}</p>`
    if (existingBtn) {
      successDiv.appendChild(existingBtn)
    }
    successDiv.classList.remove('hidden')
  }

  function clearMessages() {
    document.getElementById('merge-error').classList.add('hidden')
    document.getElementById('merge-success').classList.add('hidden')
  }

  document.getElementById('merge-btn').addEventListener('click', async () => {
    if (!pdfFile1 || !pdfFile2) {
      showError('Please select both PDF files to merge')
      return
    }

    const btn = document.getElementById('merge-btn')
    const originalText = btn.innerHTML
    btn.disabled = true
    btn.innerHTML = '<span style="display: flex; align-items: center;"><span class="loader loader-sm" style="margin-right: 0.5rem;"></span>Merging PDFs...</span>'
    clearMessages()

    try {
      const mergedPdf = await mergePdf([pdfFile1, pdfFile2])
      const filename = `merged-${Date.now()}.pdf`
      showSuccess('PDFs merged successfully! Click the button below to download.')
      createDownloadButton(mergedPdf, filename, 'merge-success')
      // Clear files
      pdfFile1 = null
      pdfFile2 = null
      updateFileInfo(1, null)
      updateFileInfo(2, null)
      updateMergeButton()
    } catch (err) {
      showError(err.message || 'Failed to merge PDFs')
    } finally {
      btn.disabled = false
      btn.innerHTML = originalText
    }
  })
}

// Split PDF Page
function initSplitPdf() {
  let pdfFile = null
  let totalPages = 0
  let pdfPreview = null

  createDropzone('split-dropzone', {
    accept: '.pdf,application/pdf',
    multiple: false,
    onFilesSelected: async (file) => {
      pdfFile = file
      document.getElementById('split-controls').classList.remove('hidden')
      
      try {
        if (!window.pdfjsLib) {
          throw new Error('PDF.js library is not loaded')
        }
        
        const arrayBuffer = await file.arrayBuffer()
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
        const pdf = await loadingTask.promise
        totalPages = pdf.numPages
        document.getElementById('split-total-pages').textContent = totalPages
        document.getElementById('split-start-page').value = 1
        document.getElementById('split-start-page').max = totalPages
        document.getElementById('split-end-page').value = totalPages
        document.getElementById('split-end-page').max = totalPages
        document.getElementById('split-btn').disabled = false

        pdfPreview = createPdfPreview('split-preview-content', pdfFile)
      } catch (err) {
        showError('Failed to load PDF. Please ensure it is a valid PDF file.')
        pdfFile = null
      }
    }
  })

  const startPageInput = document.getElementById('split-start-page')
  const endPageInput = document.getElementById('split-end-page')

  startPageInput.addEventListener('input', (e) => {
    const val = Math.max(1, Math.min(parseInt(e.target.value) || 1, totalPages))
    startPageInput.value = val
    if (val > parseInt(endPageInput.value)) {
      endPageInput.value = val
    }
  })

  endPageInput.addEventListener('input', (e) => {
    const val = Math.max(1, Math.min(parseInt(e.target.value) || 1, totalPages))
    endPageInput.value = val
    if (val < parseInt(startPageInput.value)) {
      startPageInput.value = val
    }
  })

  function showError(message) {
    const errorDiv = document.getElementById('split-error')
    errorDiv.textContent = message
    errorDiv.classList.remove('hidden')
    document.getElementById('split-success').classList.add('hidden')
  }

  function showSuccess(message) {
    const successDiv = document.getElementById('split-success')
    const existingBtn = successDiv.querySelector('.download-btn')
    successDiv.innerHTML = `<p>${message}</p>`
    if (existingBtn) {
      successDiv.appendChild(existingBtn)
    }
    successDiv.classList.remove('hidden')
    document.getElementById('split-error').classList.add('hidden')
  }

  document.getElementById('split-btn').addEventListener('click', async () => {
    if (!pdfFile) {
      showError('Please select a PDF file')
      return
    }

    const startPage = parseInt(startPageInput.value)
    const endPage = parseInt(endPageInput.value)

    if (startPage < 1 || endPage > totalPages || startPage > endPage) {
      showError(`Invalid page range. Please enter values between 1 and ${totalPages}`)
      return
    }

    const btn = document.getElementById('split-btn')
    const originalText = btn.textContent
    btn.disabled = true
    btn.innerHTML = '<span style="display: flex; align-items: center; justify-content: center;"><span class="loader loader-sm" style="margin-right: 0.5rem;"></span>Splitting PDF...</span>'
    showError('')

    try {
      const splitPdfData = await splitPdf(pdfFile, startPage, endPage)
      const filename = `split-pages-${startPage}-${endPage}-${Date.now()}.pdf`
      showSuccess('PDF split successfully! Click the button below to download.')
      createDownloadButton(splitPdfData, filename, 'split-success')
    } catch (err) {
      showError(err.message || 'Failed to split PDF')
    } finally {
      btn.disabled = false
      btn.innerHTML = originalText
    }
  })
}


// Compress PDF Page
function initCompressPdf() {
  let pdfFile = null
  let originalSize = 0
  let pdfPreview = null

  createDropzone('compress-dropzone', {
    accept: '.pdf,application/pdf',
    multiple: false,
    onFilesSelected: (file) => {
      pdfFile = file
      originalSize = file.size
      document.getElementById('compress-controls').classList.remove('hidden')
      document.getElementById('compress-file-size').innerHTML = `
        <p><strong>Original file size:</strong> ${(originalSize / 1024).toFixed(2)} KB</p>
      `
      document.getElementById('compress-btn').disabled = false
      pdfPreview = createPdfPreview('compress-preview-content', pdfFile)
    }
  })

  function showError(message, isSuccess = false) {
    const errorDiv = document.getElementById('compress-error')
    const existingBtn = errorDiv.querySelector('.download-btn')
    errorDiv.innerHTML = `<p>${message}</p>`
    if (existingBtn) {
      errorDiv.appendChild(existingBtn)
    }
    errorDiv.className = isSuccess ? 'success-message' : 'error-message'
    errorDiv.classList.remove('hidden')
  }

  document.getElementById('compress-btn').addEventListener('click', async () => {
    if (!pdfFile) {
      showError('Please select a PDF file')
      return
    }

    const btn = document.getElementById('compress-btn')
    const originalText = btn.textContent
    btn.disabled = true
    btn.innerHTML = '<span style="display: flex; align-items: center; justify-content: center;"><span class="loader loader-sm" style="margin-right: 0.5rem;"></span>Compressing PDF...</span>'
    showError('')

    try {
      const compressedPdf = await compressPdf(pdfFile)
      const filename = `compressed-${Date.now()}.pdf`
      
      const newSize = compressedPdf.length
      const reduction = ((originalSize - newSize) / originalSize * 100).toFixed(1)
      showError(`Original size: ${(originalSize / 1024).toFixed(2)} KB. New size: ${(newSize / 1024).toFixed(2)} KB. Reduction: ${reduction}%. Click the button below to download.`, true)
      createDownloadButton(compressedPdf, filename, 'compress-error')
    } catch (err) {
      showError(err.message || 'Failed to compress PDF')
    } finally {
      btn.disabled = false
      btn.innerHTML = originalText
    }
  })
}

// PDF to Image Page
function initPdfToImage() {
  let pdfFile = null
  let pageCount = 0
  let currentPage = 1
  let pdfPreview = null
  let selectedPages = new Set()

  function updateSelectedCount() {
    const count = selectedPages.size
    const countElement = document.getElementById('pdf-to-image-selected-count')
    const btn = document.getElementById('pdf-to-image-btn')
    
    if (count === 0) {
      countElement.textContent = 'No pages selected'
      btn.disabled = true
    } else {
      countElement.textContent = `${count} page${count === 1 ? '' : 's'} selected`
      btn.disabled = false
      btn.innerHTML = `Convert ${count} Page${count === 1 ? '' : 's'} to Image${count === 1 ? '' : 's'}`
    }
  }

  function createPageSelectionUI() {
    const pagesList = document.getElementById('pdf-to-image-pages-list')
    pagesList.innerHTML = ''
    
    for (let i = 1; i <= pageCount; i++) {
      const item = document.createElement('div')
      item.className = 'page-checkbox-item'
      
      const checkbox = document.createElement('input')
      checkbox.type = 'checkbox'
      checkbox.id = `page-checkbox-${i}`
      checkbox.value = i
      checkbox.checked = selectedPages.has(i)
      
      const label = document.createElement('label')
      label.htmlFor = `page-checkbox-${i}`
      label.textContent = `Page ${i}`
      
      checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          selectedPages.add(i)
        } else {
          selectedPages.delete(i)
        }
        updateSelectedCount()
      })
      
      item.appendChild(checkbox)
      item.appendChild(label)
      pagesList.appendChild(item)
    }
    
    updateSelectedCount()
  }

  createDropzone('pdf-to-image-dropzone', {
    accept: '.pdf,application/pdf',
    multiple: false,
    onFilesSelected: async (file) => {
      pdfFile = file
      selectedPages.clear()
      
      try {
        if (!window.pdfjsLib) {
          throw new Error('PDF.js library is not loaded')
        }
        
        const arrayBuffer = await file.arrayBuffer()
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
        const pdf = await loadingTask.promise
        pageCount = pdf.numPages
        currentPage = 1
        
        document.getElementById('pdf-to-image-controls').classList.remove('hidden')
        document.getElementById('pdf-to-image-info').innerHTML = `
          <p><strong>Total pages:</strong> ${pageCount}</p>
        `
        
        // Create page selection UI
        createPageSelectionUI()
        document.getElementById('pdf-to-image-page-selection').classList.remove('hidden')

        pdfPreview = createPdfPreview('pdf-to-image-preview-content', pdfFile, (page) => {
          currentPage = page
        })
      } catch (err) {
        showError('Failed to load PDF. Please ensure it is a valid PDF file.')
        pdfFile = null
      }
    }
  })

  // Select All button
  const selectAllBtn = document.getElementById('select-all-pages')
  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', () => {
      selectedPages.clear()
      for (let i = 1; i <= pageCount; i++) {
        selectedPages.add(i)
        const checkbox = document.getElementById(`page-checkbox-${i}`)
        if (checkbox) checkbox.checked = true
      }
      updateSelectedCount()
    })
  }

  // Deselect All button
  const deselectAllBtn = document.getElementById('deselect-all-pages')
  if (deselectAllBtn) {
    deselectAllBtn.addEventListener('click', () => {
      selectedPages.clear()
      for (let i = 1; i <= pageCount; i++) {
        const checkbox = document.getElementById(`page-checkbox-${i}`)
        if (checkbox) checkbox.checked = false
      }
      updateSelectedCount()
    })
  }

  async function convertPageToImage(pageNum) {
    if (!pdfFile) return null

    try {
      if (!window.pdfjsLib) {
        throw new Error('PDF.js library is not loaded')
      }
      
      const arrayBuffer = await pdfFile.arrayBuffer()
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
      const pdf = await loadingTask.promise
      const page = await pdf.getPage(pageNum)
      const viewport = page.getViewport({ scale: 2.0 })

      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      canvas.height = viewport.height
      canvas.width = viewport.width

      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise

      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          resolve(blob)
        }, 'image/png')
      })
    } catch (err) {
      throw new Error(`Failed to convert page ${pageNum} to image`)
    }
  }

  function showError(message) {
    const errorDiv = document.getElementById('pdf-to-image-error')
    errorDiv.textContent = message
    errorDiv.classList.remove('hidden')
    document.getElementById('pdf-to-image-success').classList.add('hidden')
  }

  function showSuccess(message) {
    const successDiv = document.getElementById('pdf-to-image-success')
    successDiv.textContent = message
    successDiv.classList.remove('hidden')
    document.getElementById('pdf-to-image-error').classList.add('hidden')
  }

  document.getElementById('pdf-to-image-btn').addEventListener('click', async () => {
    if (!pdfFile) {
      showError('Please select a PDF file')
      return
    }

    if (selectedPages.size === 0) {
      showError('Please select at least one page to convert')
      return
    }

    const btn = document.getElementById('pdf-to-image-btn')
    const originalText = btn.innerHTML
    btn.disabled = true
    btn.innerHTML = '<span style="display: flex; align-items: center; justify-content: center;"><span class="loader loader-sm" style="margin-right: 0.5rem;"></span>Converting Pages...</span>'
    showError('')
    showSuccess('')

    try {
      const pagesToConvert = Array.from(selectedPages).sort((a, b) => a - b)
      let successCount = 0
      let errorCount = 0

      const convertedImages = []
      for (const pageNum of pagesToConvert) {
        try {
          const blob = await convertPageToImage(pageNum)
          if (blob) {
            const filename = `page-${pageNum}-${Date.now()}.png`
            convertedImages.push({ blob, filename, pageNum })
            successCount++
          }
        } catch (err) {
          console.error(`Error converting page ${pageNum}:`, err)
          errorCount++
        }
      }

      if (successCount > 0) {
        const successDiv = document.getElementById('pdf-to-image-success')
        successDiv.classList.remove('hidden')
        document.getElementById('pdf-to-image-error').classList.add('hidden')
        
        let message = `Successfully converted ${successCount} page${successCount === 1 ? '' : 's'}`
        if (errorCount > 0) {
          message += `. ${errorCount} page${errorCount === 1 ? '' : 's'} failed.`
        }
        message += ' Click the buttons below to download:'
        successDiv.innerHTML = `<p>${message}</p>`
        
        // Create download buttons for each converted image
        convertedImages.forEach(({ blob, filename }) => {
          const downloadBtn = document.createElement('button')
          downloadBtn.className = 'btn-primary'
          downloadBtn.innerHTML = `📥 Download ${filename}`
          downloadBtn.style.marginTop = '0.5rem'
          downloadBtn.style.width = '100%'
          downloadBtn.style.display = 'block'
          
          downloadBtn.addEventListener('click', () => {
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = filename
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            setTimeout(() => URL.revokeObjectURL(url), 100)
          })
          
          successDiv.appendChild(downloadBtn)
        })
      } else {
        showError('Failed to convert selected pages. Please try again.')
      }
    } catch (err) {
      showError(err.message || 'Failed to convert PDF to image')
    } finally {
      btn.disabled = false
      btn.innerHTML = originalText
    }
  })
}

// Image to PDF Page
function initImageToPdf() {
  let imageFiles = []

  createDropzone('image-to-pdf-dropzone', {
    accept: 'image/*',
    multiple: true,
    onFilesSelected: (files) => {
      imageFiles = Array.isArray(files) ? files : [files]
      updateImageFilesList()
      document.getElementById('image-to-pdf-btn').disabled = imageFiles.length === 0
      createImagePreview('image-to-pdf-preview-content', imageFiles)
      clearMessages()
    }
  })

  function updateImageFilesList() {
    const listContainer = document.getElementById('image-to-pdf-files-list')
    if (imageFiles.length === 0) {
      listContainer.classList.add('hidden')
      return
    }

    listContainer.classList.remove('hidden')
    listContainer.innerHTML = `
      <h3 class="files-list-title">Selected Images (${imageFiles.length}):</h3>
      <ul class="max-h-40 overflow-y-auto">
        ${imageFiles.map((file, index) => `
          <li>
            <span>🖼️</span>
            ${file.name} (${(file.size / 1024).toFixed(2)} KB)
          </li>
        `).join('')}
      </ul>
    `
  }

  function showError(message) {
    const errorDiv = document.getElementById('image-to-pdf-error')
    errorDiv.textContent = message
    errorDiv.classList.remove('hidden')
    document.getElementById('image-to-pdf-success').classList.add('hidden')
  }

  function showSuccess(message) {
    const successDiv = document.getElementById('image-to-pdf-success')
    const existingBtn = successDiv.querySelector('.download-btn')
    successDiv.innerHTML = `<p>${message}</p>`
    if (existingBtn) {
      successDiv.appendChild(existingBtn)
    }
    successDiv.classList.remove('hidden')
    document.getElementById('image-to-pdf-error').classList.add('hidden')
  }

  function clearMessages() {
    document.getElementById('image-to-pdf-error').classList.add('hidden')
    document.getElementById('image-to-pdf-success').classList.add('hidden')
  }

  document.getElementById('image-to-pdf-btn').addEventListener('click', async () => {
    if (imageFiles.length === 0) {
      showError('Please select at least one image file')
      return
    }

    const btn = document.getElementById('image-to-pdf-btn')
    const originalText = btn.textContent
    btn.disabled = true
    btn.innerHTML = '<span style="display: flex; align-items: center; justify-content: center;"><span class="loader loader-sm" style="margin-right: 0.5rem;"></span>Converting to PDF...</span>'
    showError('')

    try {
      const pdfData = await imageToPdf(imageFiles)
      const filename = `images-to-pdf-${Date.now()}.pdf`
      showSuccess('PDF created successfully! Click the button below to download.')
      createDownloadButton(pdfData, filename, 'image-to-pdf-success')
      imageFiles = []
      updateImageFilesList()
      document.getElementById('image-to-pdf-preview-content').innerHTML = '<div class="preview-placeholder">Upload images to see preview</div>'
    } catch (err) {
      showError(err.message || 'Failed to convert images to PDF')
    } finally {
      btn.disabled = false
      btn.innerHTML = originalText
    }
  })
}

