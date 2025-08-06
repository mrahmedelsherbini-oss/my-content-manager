import React, { useState, useEffect } from 'react';

// Helper function for exponential backoff
const fetchWithBackoff = async (url, options, retries = 5, delay = 1000) => {
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorText = await response.text();
            // Specific error for 401 Unauthorized (likely invalid API key)
            if (response.status === 401) {
                throw new Error('Invalid API Key. Please check your Gemini API key.');
            }
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }
        return await response.json();
    } catch (error) {
        if (retries > 0 && error.message.includes('429')) { // Too Many Requests
            console.warn(`Retrying after ${delay}ms... (${retries} retries left)`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchWithBackoff(url, options, retries - 1, delay * 2);
        }
        throw error;
    }
};

const App = () => {
    const [stage, setStage] = useState('splash_screen'); // splash_screen, api_key_input, ideas_generation, idea_selection, content_generation, display_content
    const [userApiKey, setUserApiKey] = useState(''); // This will be the actual Gemini API key
    const [ideas, setIdeas] = useState([]);
    const [selectedIdea, setSelectedIdea] = useState(null);
    const [generatedContent, setGeneratedContent] = useState({
        posts: {}, // Each post will be an object: { original: '', translated: '', rephrased: '', seoOptimized: '', marketing: '' }
        bloggerArticle: null,
        imagePrompts: [],
        videoPrompts: [], // New for video prompts
        carouselSlides: [] // New for carousel
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [translatedTexts, setTranslatedTexts] = useState({}); // To store translations
    const [customInstructions, setCustomInstructions] = useState({}); // To store custom instructions for each platform/idea
    const [ideaCustomizationInput, setIdeaCustomizationInput] = useState(''); // Input for customizing ideas
    const [darkMode, setDarkMode] = useState(false); // Dark mode state
    const [showContactModal, setShowContactModal] = useState(false); // State for contact modal
    const [showWhatsappGmailModal, setShowWhatsappGmailModal] = useState(false); // State for WhatsApp/Gmail modal
    const [whatsappGmailInput, setWhatsappGmailInput] = useState(''); // Input for client message
    const [whatsappGmailResponse, setWhatsappGmailResponse] = useState(''); // AI generated response for client
    const [whatsappGmailPlatform, setWhatsappGmailPlatform] = useState(''); // Stores which platform (WhatsApp/Gmail) is active in the modal
    const [carouselSlideCount, setCarouselSlideCount] = useState(3); // Default carousel slide count
    const [processingButton, setProcessingButton] = useState(null); // Tracks which button is loading

    // Social media platform details
    const platforms = [
        { name: 'فيسبوك', icon: 'fab fa-facebook-f', url: 'https://www.facebook.com/Requires0', color: '#1877f2', type: 'post' },
        { name: 'انستجرام', icon: 'fab fa-instagram', url: 'https://www.instagram.com/requires0/', color: 'linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)', type: 'post' }, // Improved Instagram gradient
        { name: 'تيك توك', icon: 'fab fa-tiktok', url: 'https://www.tiktok.com/@requires10', color: '#000000', type: 'post' },
        { name: 'لينكد إن', icon: 'fab fa-linkedin-in', url: 'https://www.linkedin.com/in/requires0', color: '#0a66c2', type: 'post' },
        { name: 'تويتر', icon: 'fab fa-twitter', url: 'https://x.com/Requires0', color: '#1da1f2', type: 'post' },
        { name: 'واتساب', icon: 'fab fa-whatsapp', url: 'https://api.whatsapp.com/send?phone=01551053732', color: '#25d366', type: 'message' },
        { name: 'جيميل', icon: 'fas fa-envelope', url: 'mailto:requiresforeducationalservices@gmail.com', color: '#d44638', type: 'message' },
        { name: 'يوتيوب', icon: 'fab fa-youtube', url: 'https://www.youtube.com/@Requires4', color: '#ff0000', type: 'post' },
    ];

    // Contact Information for "اتصل بنا" modal (only icons and links)
    const contactInfo = [
        { label: 'الجيميل', icon: 'fas fa-envelope', link: 'mailto:requiresforeducationalservices@gmail.com', color: '#d44638' },
        { label: 'الواتساب', icon: 'fab fa-whatsapp', link: 'https://api.whatsapp.com/send?phone=01551053732', color: '#25d366' },
        { label: 'الفيسبوك', icon: 'fab fa-facebook-f', link: 'https://www.facebook.com/Requires0', color: '#1877f2' },
        { label: 'الانستجرام', icon: 'fab fa-instagram', link: 'https://www.instagram.com/requires0/', color: 'linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)' },
        { label: 'التيك توك', icon: 'fab fa-tiktok', link: 'https://www.tiktok.com/@requires10', color: '#000000' },
        { label: 'اللينكد إن', icon: 'fab fa-linkedin-in', link: 'https://www.linkedin.com/in/requires0', color: '#0a66c2' },
        { label: 'تويتر', icon: 'fab fa-twitter', link: 'https://x.com/Requires0', color: '#1da1f2' },
        { label: 'بلوجر', icon: 'fab fa-blogger-b', link: 'https://requires0.blogspot.com/', color: '#ff5722' },
        { label: 'يوتيوب', icon: 'fab fa-youtube', link: 'https://www.youtube.com/@Requires4', color: '#ff0000' },
    ];


    useEffect(() => {
        document.documentElement.classList.toggle('dark', darkMode);
    }, [darkMode]);

    // Function to handle Gemini API Key submission
    const handleApiKeySubmit = () => {
        if (userApiKey.trim()) {
            setStage('ideas_generation');
            generateIdeas(); // Automatically generate ideas after API key is set
            setError(null); // Clear any previous error
        } else {
            setError('الرجاء إدخال مفتاح الـ API الخاص بـ Gemini.');
        }
    };

    // Function to generate content ideas
    const generateIdeas = async (customInstruction = '') => {
        setLoading(true);
        setError(null);
        setProcessingButton('generate_ideas'); // Set loading for this action
        try {
            let prompt = `Generate 3-5 trending and relevant content ideas in Arabic for an academic services center named 'Requires for Academic Services'. Focus on topics related to academic research, student support, educational challenges, and professional development. The ideas should be engaging for students, researchers, and academics. Provide each idea as a short, catchy title.`;
            if (customInstruction) {
                prompt += ` Apply the following instructions: "${customInstruction}"`;
            }

            const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
            const payload = { contents: chatHistory };
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${userApiKey}`;

            const result = await fetchWithBackoff(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (result.candidates && result.candidates.length > 0 && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts.length > 0) {
                const text = result.candidates[0].content.parts[0].text;
                const parsedIdeas = text.split('\n').filter(line => line.trim().length > 0 && (line.includes('-') || line.match(/^\d+\./))).map(line => line.replace(/^(-|\d+\.)\s*/, '').trim());
                setIdeas(parsedIdeas);
                setIdeaCustomizationInput(''); // Clear custom instruction input
                if (stage !== 'idea_selection') {
                    setStage('idea_selection');
                }
            } else {
                setError('فشل في توليد الأفكار. الرجاء المحاولة مرة أخرى.');
            }
        } catch (err) {
            console.error('Error generating ideas:', err);
            setError('حدث خطأ أثناء توليد الأفكار: ' + err.message);
        } finally {
            setLoading(false);
            setProcessingButton(null); // Clear loading
        }
    };

    // Function to generate specific content (post, article, or image prompts)
    const generateSpecificContent = async (contentType, target = null) => {
        setLoading(true);
        setProcessingButton(`${contentType}-${target || 'global'}`); // Set loading for this action
        setError(null);
        try {
            let prompt;
            let result;
            let apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${userApiKey}`;

            if (contentType === 'post' && target) {
                const platform = platforms.find(p => p.name === target);
                if (!platform) {
                    setError('منصة غير معروفة.');
                    setLoading(false);
                    setProcessingButton(null);
                    return;
                }
                prompt = `Generate a professional and engaging ${platform.name} post in Arabic about '${selectedIdea}' for 'Requires for Academic Services'. Include relevant emojis and hashtags.`;
                if (platform.name === 'فيسبوك' || platform.name === 'لينكد إن') {
                    prompt += ` Max 200 words.`;
                } else if (platform.name === 'تويتر') {
                    prompt += ` Be concise (max 280 characters).`;
                } else if (platform.name === 'انستجرام') {
                    prompt += ` Focus on visual appeal, concise text, and strong hashtags.`;
                } else if (platform.name === 'تيك توك') {
                    prompt += ` Suggest a visual concept and trending audio idea suitable for a short, engaging video.`;
                } else if (platform.name === 'يوتيوب') {
                    prompt += ` Suggest a YouTube video title and a short, engaging description with keywords.`;
                }

                result = await fetchWithBackoff(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] })
                });

                const newContent = result.candidates?.[0]?.content?.parts?.[0]?.text || `فشل في توليد المحتوى لـ ${platform.name}.`;
                setGeneratedContent(prev => ({
                    ...prev,
                    posts: {
                        ...prev.posts,
                        [platform.name]: { original: newContent } // Initialize original
                    }
                }));
            } else if (contentType === 'bloggerArticle') {
                prompt = `Generate the complete HTML content for the main article section (<div class="article-content">...</div>) for a Blogger post about '${selectedIdea}' for 'Requires for Academic Services'. Adhere strictly to the following HTML structure and CSS classes: article-paragraph, section-title, subsection-title, bullet-list, numbered-list, highlight-box, quote-box, decorative-divider. Ensure id attributes for sections (e.g., id="section1", id="section2", etc.) are present for internal linking from a table of contents. The content should be professional, insightful, and comprehensive, reflecting the quality of 'Requires for Academic Services'. Do not include <html>, <head>, <body>, or any external CSS/JS links. Only generate the content that goes inside the <div class="article-content">. Ensure all text is in Arabic. Include a table of contents within the article-content div, linking to the sections you create. Make sure the content is rich and detailed, similar to the example you provided previously about academic plagiarism.`;

                result = await fetchWithBackoff(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] })
                });
                setGeneratedContent(prev => ({
                    ...prev,
                    bloggerArticle: result.candidates?.[0]?.content?.parts?.[0]?.text || `فشل في توليد مقال بلوجر.`
                }));
            } else if (contentType === 'imagePrompts') {
                prompt = `Generate one single, highly detailed, professional, and visually appealing AI image generation prompt (in English) for a poster related to the topic '${selectedIdea}'. The image should be conceptual, without any text, and suitable for an academic services center. Focus on abstract representations, metaphors, or symbolic imagery. The prompt should aim for high-quality, modern, clean aesthetics, suitable for a digital art style, with vibrant colors and a sense of academic excellence.`;

                result = await fetchWithBackoff(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] })
                });
                const generatedPrompt = result.candidates?.[0]?.content?.parts?.[0]?.text || 'فشل في توليد أمر الصورة.';
                setGeneratedContent(prev => ({
                    ...prev,
                    imagePrompts: [generatedPrompt]
                }));
            } else if (contentType === 'videoPrompts') { // New video prompt generation
                prompt = `Generate one single, highly detailed, professional, and visually appealing AI video generation prompt (in English) for a short promotional video related to the topic '${selectedIdea}' for 'Requires for Academic Services'. The video should be conceptual, dynamic, and engaging, without spoken dialogue. Describe visual scenes, transitions, and potential background music mood. Focus on abstract representations of academic excellence, problem-solving, and support. Include a description for a subtle, integrated logo of 'Requires for Academic Services' (e.g., a glowing watermark or appearing briefly at the end). The prompt should aim for high-quality, modern, and clean aesthetics.`;
                result = await fetchWithBackoff(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] })
                });
                const generatedVideoPrompt = result.candidates?.[0]?.content?.parts?.[0]?.text || 'فشل في توليد أمر الفيديو.';
                setGeneratedContent(prev => ({
                    ...prev,
                    videoPrompts: [generatedVideoPrompt]
                }));
            } else if (contentType === 'carouselSlides') { // New carousel generation
                const numSlides = target; // target is now slide count
                prompt = `Generate ${numSlides} concise and engaging text slides in Arabic for a social media carousel post about '${selectedIdea}' for 'Requires for Academic Services'. Each slide should have a clear, distinct message, building upon the previous one. Focus on key benefits or steps related to the topic. Format each slide as "Slide X: [Title]\n[Short Description]".`;
                result = await fetchWithBackoff(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] })
                });
                const slidesText = result.candidates?.[0]?.content?.parts?.[0]?.text || 'فشل في توليد شرائح الكاروسيل.';
                const parsedSlides = slidesText.split('\n\n').filter(s => s.trim() !== '').map(s => {
                    const parts = s.split('\n');
                    return { title: parts[0].replace(/Slide \d+: /, '').trim(), description: parts.slice(1).join('\n').trim() };
                });
                setGeneratedContent(prev => ({
                    ...prev,
                    carouselSlides: parsedSlides
                }));
            }
            setStage('display_content'); // Ensure we are on the display stage after generation
        } catch (err) {
            console.error(`Error generating ${contentType} content:`, err);
            setError(`حدث خطأ أثناء توليد ${contentType === 'post' ? 'المنشور' : contentType === 'bloggerArticle' ? 'المقال' : contentType === 'imagePrompts' ? 'أوامر الصور' : contentType === 'videoPrompts' ? 'أوامر الفيديو' : 'شرائح الكاروسيل'}: ${err.message}`);
        } finally {
            setLoading(false);
            setProcessingButton(null); // Clear loading
        }
    };

    // Function to generate all content (Social media, Blogger, Image Prompts)
    const generateAllContent = async (idea) => {
        setSelectedIdea(idea);
        setLoading(true);
        setError(null);
        setGeneratedContent({ posts: {}, bloggerArticle: null, imagePrompts: [], videoPrompts: [], carouselSlides: [] }); // Reset all content
        setStage('content_generation'); // Show loading for content generation
        setProcessingButton('generate_all');

        try {
            // Generate all social media posts, blogger article, and image prompts in parallel
            const postPromises = platforms.filter(p => p.type === 'post').map(platform => generateSpecificContent('post', platform.name));
            const bloggerPromise = generateSpecificContent('bloggerArticle');
            const imagePromptsPromise = generateSpecificContent('imagePrompts');
            const videoPromptsPromise = generateSpecificContent('videoPrompts'); // Generate video prompts too
            const carouselPromise = generateSpecificContent('carouselSlides', carouselSlideCount); // Generate carousel too
            
            await Promise.all([...postPromises, bloggerPromise, imagePromptsPromise, videoPromptsPromise, carouselPromise]);
            setStage('display_content');
        } catch (err) {
            console.error('Error in generateAllContent:', err);
            setError('حدث خطأ أثناء توليد كل المحتوى: ' + err.message);
        } finally {
            setLoading(false);
            setProcessingButton(null);
        }
    };

    // Function to generate a response for WhatsApp/Gmail client message
    const generateWhatsappGmailResponse = async () => {
        if (!whatsappGmailInput.trim()) {
            setError('الرجاء إدخال رسالة العميل.');
            return;
        }
        setLoading(true);
        setProcessingButton('whatsapp_gmail_response');
        setError(null);
        setWhatsappGmailResponse(''); // Clear previous response

        try {
            let prompt;
            if (whatsappGmailPlatform === 'واتساب') {
                prompt = `Generate a concise, friendly, and professional WhatsApp response in Arabic to a client message: "${whatsappGmailInput}". The response should be from 'Requires for Academic Services' and offer assistance. Include a call to action with our WhatsApp number 01551053732.`;
            } else if (whatsappGmailPlatform === 'جيميل') {
                prompt = `Generate a formal and professional email response in Arabic to a client message: "${whatsappGmailInput}". The response should be from 'Requires for Academic Services', address the client formally, offer detailed assistance, and include our Gmail: requiresforeducationalservices@gmail.com. Provide only the email body, no subject or salutation.`;
            }

            const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
            const payload = { contents: chatHistory };
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${userApiKey}`;

            const result = await fetchWithBackoff(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (result.candidates && result.candidates.length > 0 && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts.length > 0) {
                setWhatsappGmailResponse(result.candidates[0].content.parts[0].text);
            } else {
                setError(`فشل في توليد الرد لـ ${whatsappGmailPlatform}.`);
            }
        } catch (err) {
            console.error(`Error generating ${whatsappGmailPlatform} response:`, err);
            setError(`حدث خطأ أثناء توليد الرد لـ ${whatsappGmailPlatform}: ${err.message}`);
        } finally {
            setLoading(false);
            setProcessingButton(null);
        }
    };

    // Function to regenerate a specific social media post
    const regeneratePost = async (platformName, currentContent) => {
        setLoading(true);
        setProcessingButton(`rephrase-${platformName}`);
        setError(null);
        try {
            const prompt = `Rephrase the following ${platformName} post in Arabic, making it slightly different but maintaining the original meaning and professional tone for 'Requires for Academic Services'. Original post: "${currentContent}"`;
            const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
            const payload = { contents: chatHistory };
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${userApiKey}`;

            const result = await fetchWithBackoff(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (result.candidates && result.candidates.length > 0 && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts.length > 0) {
                const newContent = result.candidates[0].content.parts[0].text;
                setGeneratedContent(prev => ({
                    ...prev,
                    posts: {
                        ...prev.posts,
                        [platformName]: { ...prev.posts[platformName], rephrased: newContent }
                    }
                }));
            } else {
                setError(`فشل في إعادة صياغة منشور ${platformName}.`);
            }
        } catch (err) {
            console.error(`Error regenerating ${platformName} post:`, err);
            setError(`حدث خطأ أثناء إعادة صياغة منشور ${platformName}: ${err.message}`);
        } finally {
            setLoading(false);
            setProcessingButton(null);
        }
    };

    // Function to customize a specific social media post or message response
    const customizeContent = async (contentType, targetName, currentContent, instructions) => {
        if (!instructions.trim()) {
            setError('الرجاء إدخال تعليمات التخصيص.');
            return;
        }
        setLoading(true);
        setProcessingButton(`customize-${targetName}`);
        setError(null);
        try {
            let prompt;
            if (contentType === 'post') {
                prompt = `Refine the following ${targetName} post in Arabic based on these instructions: "${instructions}". Keep the professional tone for 'Requires for Academic Services'. Original post: "${currentContent}"`;
            } else if (contentType === 'message') {
                prompt = `Refine the following ${targetName} message response in Arabic based on these instructions: "${instructions}". Maintain the appropriate tone for a client message from 'Requires for Academic Services'. Original message: "${currentContent}"`;
            }

            const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
            const payload = { contents: chatHistory };
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${userApiKey}`;

            const result = await fetchWithBackoff(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (result.candidates && result.candidates.length > 0 && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts.length > 0) {
                const newContent = result.candidates[0].content.parts[0].text;
                if (contentType === 'post') {
                    setGeneratedContent(prev => ({
                        ...prev,
                        posts: {
                            ...prev.posts,
                            [targetName]: { ...prev.posts[targetName], customized: newContent }
                        }
                    }));
                } else if (contentType === 'message') {
                    setWhatsappGmailResponse(newContent); // Update directly for modal response
                }
                setCustomInstructions(prev => ({ ...prev, [targetName]: '' })); // Clear instructions after use
            } else {
                setError(`فشل في تخصيص ${targetName}.`);
            }
        } catch (err) {
            console.error(`Error customizing ${targetName}:`, err);
            setError(`حدث خطأ أثناء تخصيص ${targetName}: ${err.message}`);
        } finally {
            setLoading(false);
            setProcessingButton(null);
        }
    };

    // Function to generate marketing-focused post
    const generateMarketingPost = async (platformName, currentContent) => {
        setLoading(true);
        setProcessingButton(`marketing-${platformName}`);
        setError(null);
        try {
            const prompt = `Rewrite the following ${platformName} post in Arabic to be a marketing-focused post for 'Requires for Academic Services'. Emphasize how 'Requires for Academic Services' can help with the topic of the post (e.g., ensuring originality, preventing plagiarism, academic support). Make it persuasive and professional. Original post: "${currentContent}"`;
            const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
            const payload = { contents: chatHistory };
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${userApiKey}`;

            const result = await fetchWithBackoff(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (result.candidates && result.candidates.length > 0 && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts.length > 0) {
                const newContent = result.candidates[0].content.parts[0].text;
                setGeneratedContent(prev => ({
                    ...prev,
                    posts: {
                        ...prev.posts,
                        [platformName]: { ...prev.posts[platformName], marketing: newContent }
                    }
                }));
            } else {
                setError(`فشل في توليد منشور تسويقي لـ ${platformName}.`);
            }
        } catch (err) {
            console.error(`Error generating marketing post for ${platformName}:`, err);
            setError(`حدث خطأ أثناء توليد منشور تسويقي لـ ${platformName}: ${err.message}`);
        } finally {
            setLoading(false);
            setProcessingButton(null);
        }
    };

    // Function to optimize post for SEO
    const optimizePostForSEO = async (platformName, currentContent) => {
        setLoading(true);
        setProcessingButton(`seo-${platformName}`);
        setError(null);
        try {
            const prompt = `Rewrite the following ${platformName} post in Arabic to be optimized for SEO. Focus on incorporating relevant keywords naturally, improving readability, and making it more discoverable. Keep the professional tone for 'Requires for Academic Services'. Original post: "${currentContent}"`;
            const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
            const payload = { contents: chatHistory };
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${userApiKey}`;

            const result = await fetchWithBackoff(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (result.candidates && result.candidates.length > 0 && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts.length > 0) {
                const newContent = result.candidates[0].content.parts[0].text;
                setGeneratedContent(prev => ({
                    ...prev,
                    posts: {
                        ...prev.posts,
                        [platformName]: { ...prev.posts[platformName], seoOptimized: newContent }
                    }
                }));
            } else {
                setError(`فشل في تحسين منشور ${platformName} للسيو.`);
            }
        } catch (err) {
            console.error(`Error optimizing ${platformName} post for SEO:`, err);
            setError(`حدث خطأ أثناء تحسين منشور ${platformName} للسيو: ${err.message}`);
        } finally {
            setLoading(false);
            setProcessingButton(null);
        }
    };

    // Function to generate hashtags/keywords
    const generateHashtagsKeywords = async (platformName, currentContent) => {
        setLoading(true);
        setProcessingButton(`hashtags-${platformName}`);
        setError(null);
        try {
            const prompt = `Generate a list of 5-10 highly relevant and trending hashtags and keywords in Arabic for the following ${platformName} post. Focus on academic services, education, and the specific topic of the post. Post content: "${currentContent}"`;
            const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
            const payload = { contents: chatHistory };
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${userApiKey}`;

            const result = await fetchWithBackoff(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (result.candidates && result.candidates.length > 0 && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts.length > 0) {
                const tags = result.candidates[0].content.parts[0].text;
                alert(`الهاشتاغات والكلمات المفتاحية المقترحة لـ ${platformName}:\n\n${tags}`); // Display in alert for now
            } else {
                setError(`فشل في توليد الهاشتاغات/الكلمات المفتاحية لـ ${platformName}.`);
            }
        } catch (err) {
            console.error(`Error generating hashtags/keywords for ${platformName}:`, err);
            setError(`حدث خطأ أثناء توليد الهاشتاغات/الكلمات المفتاحية لـ ${platformName}: ${err.message}`);
        } finally {
            setLoading(false);
            setProcessingButton(null);
        }
    };

    // Function to provide performance tips
    const providePerformanceTips = async (platformName, currentContent) => {
        setLoading(true);
        setProcessingButton(`tips-${platformName}`);
        setError(null);
        try {
            const prompt = `Provide 3-5 concise and actionable tips in Arabic to improve the performance and engagement of the following ${platformName} post. Focus on best practices for that specific platform. Post content: "${currentContent}"`;
            const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
            const payload = { contents: chatHistory };
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${userApiKey}`;

            const result = await fetchWithBackoff(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (result.candidates && result.candidates.length > 0 && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts.length > 0) {
                const tips = result.candidates[0].content.parts[0].text;
                alert(`نصائح لتحسين أداء منشور ${platformName}:\n\n${tips}`); // Display in alert for now
            } else {
                setError(`فشل في تقديم نصائح الأداء لـ ${platformName}.`);
            }
        } catch (err) {
            console.error(`Error providing performance tips for ${platformName}:`, err);
            setError(`حدث خطأ أثناء تقديم نصائح الأداء لـ ${platform.name}: ${err.message}`);
        } finally {
            setLoading(false);
            setProcessingButton(null);
        }
    };


    // Function to translate text to English
    const translateText = async (text, key, contentType, targetName) => {
        setLoading(true);
        setProcessingButton(`translate-${key}`);
        setError(null);
        try {
            const prompt = `Translate the following Arabic text to English: "${text}"`;
            const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
            const payload = { contents: chatHistory };
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${userApiKey}`;

            const result = await fetchWithBackoff(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (result.candidates && result.candidates.length > 0 && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts.length > 0) {
                const translated = result.candidates[0].content.parts[0].text;
                setTranslatedTexts(prev => ({ ...prev, [key]: translated }));
                // Update the generatedContent for posts if it's a post translation
                if (contentType === 'post') {
                    setGeneratedContent(prev => ({
                        ...prev,
                        posts: {
                            ...prev.posts,
                            [targetName]: { ...prev.posts[targetName], translated: translated }
                        }
                    }));
                }
            } else {
                setError(`فشل في الترجمة.`);
            }
        } catch (err) {
            console.error('Error translating text:', err);
            setError(`حدث خطأ أثناء الترجمة: ${err.message}`);
        } finally {
            setLoading(false);
            setProcessingButton(null);
        }
    };

    // Function to copy text to clipboard
    const copyToClipboard = (text) => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            // Using a simple alert for now, can be replaced by a custom modal
            alert('تم نسخ المحتوى بنجاح!');
        } catch (err) {
            console.error('Failed to copy text: ', err);
            alert('فشل نسخ المحتوى. يرجى النسخ يدوياً.');
        }
        document.body.removeChild(textarea);
    };

    // Function to handle direct sharing (simplified)
    const shareContent = (platform, text, url = '') => {
        let shareUrl = '';
        const encodedText = encodeURIComponent(text);
        const encodedUrl = encodeURIComponent(url);

        if (platform === 'فيسبوك') {
            shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`;
        } else if (platform === 'تويتر') {
            shareUrl = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
        } else if (platform === 'لينكد إن') {
            shareUrl = `https://www.linkedin.com/shareArticle?mini=true&url=${encodedUrl}&title=${encodedText.substring(0, 100)}&summary=${encodedText}`;
        } else {
            alert(`لا يمكن المشاركة مباشرة على ${platform} من داخل هذا التطبيق. يرجى النسخ واللصق يدوياً.`);
            return;
        }

        window.open(shareUrl, '_blank', 'noopener,noreferrer');
    };


    // Function to reset the app to initial state
    const startNewDay = () => {
        setStage('ideas_generation');
        setIdeas([]);
        setSelectedIdea(null);
        setGeneratedContent({ posts: {}, bloggerArticle: null, imagePrompts: [], videoPrompts: [], carouselSlides: [] });
        setLoading(false);
        setError(null);
        setTranslatedTexts({}); // Clear translations
        setCustomInstructions({}); // Clear custom instructions
        setIdeaCustomizationInput(''); // Clear idea customization input
        generateIdeas(); // Immediately generate new ideas for the new day
    };

    // Function to go back to idea selection (from display content)
    const goBackToIdeaSelection = () => {
        setStage('idea_selection');
        setGeneratedContent({ posts: {}, bloggerArticle: null, imagePrompts: [], videoPrompts: [], carouselSlides: [] });
        setSelectedIdea(null);
        setTranslatedTexts({});
        setCustomInstructions({});
    };

    // Function to go back to API key input
    const goBackToApiKeyInput = () => {
        setStage('api_key_input');
        setUserApiKey('');
        setIdeas([]);
        setSelectedIdea(null);
        setGeneratedContent({ posts: {}, bloggerArticle: null, imagePrompts: [], videoPrompts: [], carouselSlides: [] });
        setLoading(false);
        setError(null);
        setTranslatedTexts({});
        setCustomInstructions({});
        setIdeaCustomizationInput('');
    };

    // Function to navigate to the previous stage
    const goToPreviousStage = () => {
        if (stage === 'api_key_input') {
            setStage('splash_screen'); // Go back to splash screen if on API key input
        } else if (stage === 'ideas_generation') {
            setStage('api_key_input');
        } else if (stage === 'idea_selection') {
            setStage('ideas_generation');
            generateIdeas(); // Re-generate ideas if going back to this stage
        } else if (stage === 'content_generation') {
            setStage('idea_selection');
        } else if (stage === 'display_content') {
            setStage('content_generation');
        }
        setError(null); // Clear error on navigation
    };

    // Function to navigate to the next stage (simplified, depends on current stage logic)
    const goToNextStage = () => {
        if (stage === 'splash_screen') {
            setStage('api_key_input');
        } else if (stage === 'api_key_input') {
            handleApiKeySubmit(); // Try to move to ideas generation
        } else if (stage === 'ideas_generation' && ideas.length > 0) {
            setStage('idea_selection');
        } else if (stage === 'idea_selection' && selectedIdea) {
            setStage('content_generation');
        } else if (stage === 'content_generation' && (generatedContent.bloggerArticle || Object.keys(generatedContent.posts).length > 0 || generatedContent.imagePrompts.length > 0 || generatedContent.videoPrompts.length > 0 || generatedContent.carouselSlides.length > 0)) { // Check if any content is generated
            setStage('display_content');
        }
    };

    // Function to refresh current stage content
    const refreshCurrentStage = () => {
        setError(null); // Clear any existing errors
        if (stage === 'ideas_generation' || stage === 'idea_selection') {
            generateIdeas(ideaCustomizationInput); // Re-generate ideas with current customization
        } else if (stage === 'content_generation' && selectedIdea) {
            // Re-generate all content if on content generation screen
            generateAllContent(selectedIdea);
        } else if (stage === 'display_content' && selectedIdea) {
            // Re-generate all content if on display screen
            generateAllContent(selectedIdea);
        } else {
            // Fallback for other stages or if no idea selected yet
            alert('لا يمكن تحديث هذه الصفحة حالياً. يرجى المتابعة أو البدء من جديد.');
        }
    };


    // Blogger HTML Template (from user's input) - to be filled dynamically
    const getBloggerFullHtml = (articleContentHtml, articleTitle) => `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${articleTitle || 'مقال ريكويرز للخدمات الأكاديمية'}</title>
    <!-- Google Fonts: Tajawal -->
    <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800&display=swap" rel="stylesheet">
    <!-- Font Awesome for Icons -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css">
    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: #f0f2f5; /* لون خلفية خفيف للجسم */
            font-family: 'Tajawal', Arial, sans-serif;
            direction: rtl; /* لضمان الاتجاه من اليمين لليسار */
            overflow-x: hidden; /* لمنع شريط التمرير الأفقي */
        }
        .dark body {
            background-color: #1a202c;
            color: #e2e8f0;
        }

        .article-container {
            font-family: 'Tajawal', Arial, sans-serif;
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            color: #2c3e50;
            line-height: 1.8;
            direction: rtl;
        }
        .dark .article-container {
            background: linear-gradient(135deg, #4a0e4a 0%, #2d0a4d 100%);
            color: #e2e8f0;
        }
        
        .article-header {
            text-align: center;
            margin-bottom: 40px;
            padding: 40px 20px;
            background: rgba(255,255,255,0.95);
            border-radius: 15px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
        }
        .dark .article-header {
            background: rgba(30,41,59,0.95);
            border: 1px solid rgba(255,255,255,0.1);
        }
        
        .article-title {
            font-size: 2.5em;
            font-weight: 800;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 20px;
            text-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .dark .article-title {
            background: linear-gradient(135deg, #a78bfa 0%, #d8b4fe 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .article-meta {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 20px;
            flex-wrap: wrap;
            margin-top: 20px;
            color: #666;
            font-size: 0.9em;
        }
        .dark .article-meta {
            color: #a0aec0;
        }
        
        .meta-item {
            display: flex;
            align-items: center;
            gap: 5px;
            padding: 8px 15px;
            background: rgba(102, 126, 234, 0.1);
            border-radius: 20px;
            transition: all 0.3s ease;
        }
        .dark .meta-item {
            background: rgba(167, 139, 250, 0.1);
        }
        
        .meta-item:hover {
            background: rgba(102, 126, 234, 0.2);
            transform: translateY(-2px);
        }
        .dark .meta-item:hover {
            background: rgba(167, 139, 250, 0.2);
        }
        
        .reading-time {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 10px 20px;
            border-radius: 25px;
            font-weight: 600;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
        }
        .dark .reading-time {
            background: linear-gradient(135deg, #a78bfa 0%, #d8b4fe 100%);
            box-shadow: 0 4px 15px rgba(167, 139, 250, 0.3);
        }
        
        .article-content {
            background: rgba(255,255,255,0.95);
            padding: 40px;
            border-radius: 15px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
            margin-bottom: 30px;
        }
        .dark .article-content {
            background: rgba(30,41,59,0.95);
            border: 1px solid rgba(255,255,255,0.1);
        }
        
        .section-title {
            font-size: 1.8em;
            font-weight: 700;
            color: #4d22bb;
            margin: 30px 0 20px 0;
            position: relative;
            padding-right: 20px;
            border-right: 4px solid #667eea;
        }
        .dark .section-title {
            color: #d8b4fe;
            border-right-color: #a78bfa;
        }
        
        .subsection-title {
            font-size: 1.4em;
            font-weight: 600;
            color: #5a67d8;
            margin: 25px 0 15px 0;
            position: relative;
            padding-right: 25px;
        }
        .dark .subsection-title {
            color: #a78bfa;
        }
        
        .subsection-title::before {
            content: '';
            position: absolute;
            right: 0;
            top: 50%;
            transform: translateY(-50%);
            width: 15px;
            height: 15px;
            background: #667eea;
            border-radius: 50%;
        }
        .dark .subsection-title::before {
            background: #a78bfa;
        }
        
        .article-paragraph {
            font-size: 1.1em;
            line-height: 1.9;
            margin-bottom: 20px;
            text-align: justify;
            color: #2d3748;
            font-weight: 400;
        }
        .dark .article-paragraph {
            color: #e2e8f0;
        }
        
        .highlight-box {
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
            border-right: 4px solid #667eea;
            padding: 20px 20px 20px 50px;
            margin: 25px 0;
            border-radius: 10px;
            position: relative;
            box-shadow: 0 4px 15px rgba(0,0,0,0.05);
        }
        .dark .highlight-box {
            background: linear-gradient(135deg, rgba(167, 139, 250, 0.1) 0%, rgba(216, 180, 254, 0.1) 100%);
            border-right-color: #a78bfa;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }
        
        .highlight-box::before {
            content: 'i';
            position: absolute;
            top: 20px;
            right: 20px;
            font-size: 1.2em;
            color: white;
            font-weight: bold;
            background: #667eea;
            border-radius: 50%;
            width: 25px;
            height: 25px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-style: italic;
        }
        .dark .highlight-box::before {
            background: #a78bfa;
        }
        
        .decorative-divider {
            text-align: center;
            margin: 40px 0;
            position: relative;
        }
        
        .decorative-divider::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(90deg, transparent 0%, #667eea 20%, #764ba2 50%, #667eea 80%, transparent 100%);
            z-index: 1;
        }
        .dark .decorative-divider::before {
            background: linear-gradient(90deg, transparent 0%, #a78bfa 20%, #d8b4fe 50%, #a78bfa 80%, transparent 100%);
        }
        
        .decorative-divider span {
            background: rgba(255,255,255,0.95);
            padding: 0 20px;
            color: #667eea;
            font-size: 1.5em;
            position: relative;
            z-index: 2;
            font-weight: bold;
        }
        .dark .decorative-divider span {
            background: rgba(30,41,59,0.95);
            color: #a78bfa;
        }
        
        .bullet-list {
            list-style: none;
            padding-right: 0;
            margin: 20px 0;
        }
        
        .bullet-list li {
            position: relative;
            padding-right: 30px;
            margin-bottom: 15px;
            font-size: 1.1em;
            line-height: 1.7;
        }
        
        .bullet-list li::before {
            content: '';
            position: absolute;
            right: 8px;
            top: 12px;
            width: 8px;
            height: 8px;
            background: #667eea;
            border-radius: 50%;
        }
        .dark .bullet-list li::before {
            background: #a78bfa;
        }
        
        .numbered-list {
            counter-reset: item-counter;
            list-style: none;
            padding-right: 0;
            margin: 20px 0;
        }
        
        .numbered-list li {
            position: relative;
            padding-right: 50px;
            margin-bottom: 15px;
            font-size: 1.1em;
            line-height: 1.7;
            counter-increment: item-counter;
        }
        
        .numbered-list li::before {
            content: counter(item-counter);
            position: absolute;
            right: 0;
            top: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 0.9em;
        }
        .dark .numbered-list li::before {
            background: linear-gradient(135deg, #a78bfa 0%, #d8b4fe 100%);
        }
        
        .quote-box {
            background: rgba(255,255,255,0.9);
            border-right: 4px solid #667eea;
            padding: 25px 25px 25px 60px;
            margin: 30px 0;
            border-radius: 10px;
            position: relative;
            font-style: italic;
            font-size: 1.15em;
            box-shadow: 0 4px 15px rgba(0,0,0,0.05);
        }
        .dark .quote-box {
            background: rgba(30,41,59,0.9);
            border-right-color: #a78bfa;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }
        
        .quote-box::before {
            content: '"';
            position: absolute;
            top: 10px;
            right: 20px;
            font-size: 3em;
            color: #667eea;
            opacity: 0.3;
            font-family: serif;
            line-height: 1;
        }
        .dark .quote-box::before {
            color: #a78bfa;
        }
        
        .progress-bar {
            position: fixed;
            top: 0;
            left: 0;
            width: 0%;
            height: 4px;
            background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
            z-index: 1000;
            transition: width 0.3s ease;
        }
        .dark .progress-bar {
            background: linear-gradient(90deg, #a78bfa 0%, #d8b4fe 100%);
        }
        
        .table-of-contents {
            background: rgba(255,255,255,0.9);
            border: 2px solid rgba(102, 126, 234, 0.2);
            border-radius: 15px;
            padding: 25px;
            margin: 30px auto; /* Added auto for horizontal centering */
            max-width: 800px; /* Adjusted max-width for TOC */
        }
        .dark .table-of-contents {
            background: rgba(30,41,59,0.9);
            border-color: rgba(167, 139, 250, 0.2);
        }
        
        .toc-title {
            font-size: 1.3em;
            font-weight: 700;
            color: #4d22bb;
            margin-bottom: 15px;
            text-align: center;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
            display: inline-block;
        }
        .dark .toc-title {
            color: #d8b4fe;
            border-bottom-color: #a78bfa;
        }
        
        .toc-list {
            list-style: none;
            padding-right: 0;
        }
        
        .toc-list li {
            margin-bottom: 10px;
            position: relative;
            padding-right: 20px;
        }
        
.toc-list li::before {
            content: '';
            position: absolute;
            right: 0;
            top: 12px;
            width: 6px;
            height: 6px;
            background: #667eea;
            border-radius: 50%;
        }
        .dark .toc-list li::before {
            background: #a78bfa;
        }
        
        .toc-list a {
            color: #5a67d8;
            text-decoration: none;
            font-weight: 500;
            transition: all 0.3s ease;
            display: block;
            padding: 8px 15px;
            border-radius: 8px;
        }
        .dark .toc-list a {
            color: #a78bfa;
        }
        
        .toc-list a:hover {
            background: rgba(102, 126, 234, 0.1);
            color: #4d22bb;
            transform: translateX(-5px);
        }
        .dark .toc-list a:hover {
            background: rgba(167, 139, 250, 0.1);
            color: #d8b4fe;
        }
        
        .conclusion-box {
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
            border: 2px solid rgba(102, 126, 234, 0.3);
            border-radius: 15px;
            padding: 30px;
            margin: 40px 0;
            text-align: center;
        }
        .dark .conclusion-box {
            background: linear-gradient(135deg, rgba(167, 139, 250, 0.1) 0%, rgba(216, 180, 254, 0.1) 100%);
            border-color: rgba(167, 139, 250, 0.3);
        }
        
        .conclusion-title {
            font-size: 1.5em;
            font-weight: 700;
            color: #4d22bb;
            margin-bottom: 20px;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
            display: inline-block;
        }
        .dark .conclusion-title {
            color: #d8b4fe;
            border-bottom-color: #a78bfa;
        }
        
        @media (max-width: 768px) {
            .article-container {
                padding: 15px;
                margin: 10px;
            }
            
            .article-title {
                font-size: 2em;
            }
            
            .article-content {
                padding: 25px;
            }
            
            .article-meta {
                flex-direction: column;
                gap: 10px;
            }
        }
        
        /* Animation for scroll */
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .fade-in {
            animation: fadeInUp 0.6s ease-out forwards; /* Added forwards to keep the end state */
        }

        /* Social Icons specific CSS */
        .social-icons-container {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 15px;
            margin-top: 30px;
            flex-wrap: wrap;
        }
        .social-icon-link {
            width: 48px;
            height: 48px;
            display: flex;
            justify-content: center;
            align-items: center;
            background-color: rgba(255, 255, 255, 0.9);
            border-radius: 8px;
            transition: all 0.3s ease;
            position: relative;
        }
        .dark .social-icon-link {
            background-color: rgba(45,55,72,0.9);
        }
        .social-icon-link i {
            font-size: 24px;
            color: #4d22bb;
            transition: all 0.3s ease;
        }
        .dark .social-icon-link i {
            color: #a78bfa;
        }
        .social-icon-link:hover {
            transform: translateY(-5px) scale(1.1);
            background-color: #4d22bb;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        }
        .dark .social-icon-link:hover {
            background-color: #a78bfa;
        }
        .social-icon-link:hover i {
            color: white;
        }
        .social-icon-link.gmail:hover { background-color: #d44638; }
        .social-icon-link.facebook:hover { background-color: #1877f2; }
        .social-icon-link.instagram:hover { background: radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%); }
        .social-icon-link.tiktok:hover { background-color: #000; }
        .social-icon-link.linkedin:hover { background-color: #0a66c2; }
        .social-icon-link.twitter:hover { background-color: #1da1f2; }
        .social-icon-link.blogger:hover { background-color: #ff5722; }
        .social-icon-link.whatsapp:hover { background-color: #25d366; }
    </style>
</head>
<body>

<div class="progress-bar" id="progressBar"></div>

<div class="article-container">
    <div class="article-header fade-in">
        <h1 class="article-title">${articleTitle || 'عنوان المقال'}</h1>
        <div class="article-meta">
            <div class="meta-item">
                <i class="fas fa-calendar-alt"></i>
                <span>${new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long' })}</span>
            </div>
            <div class="meta-item">
                <i class="fas fa-user"></i>
                <span>Requires for Academic Services</span>
            </div>
            <div class="reading-time">
                <i class="fas fa-clock"></i>
                <span>5-7 دقائق قراءة</span>
            </div>
        </div>
    </div>

    ${articleContentHtml}

    <div class="contact-info" style="text-align:center; margin-top:40px;">
        <p class="mb-4" style="color: white; font-size: 1.1em; font-weight: 500;">للمزيد من المساعدة في أبحاثك الأكاديمية، لا تتردد في التواصل معنا:</p>
        
        <div class="social-icons-container">
            <a href="mailto:requiresforeducationalservices@gmail.com" class="social-icon-link gmail" aria-label="Gmail" target="_blank" rel="noopener">
                <i class="fas fa-envelope"></i>
            </a>
            <a href="https://www.facebook.com/Requires0" class="social-icon-link facebook" aria-label="Facebook" target="_blank" rel="noopener">
                <i class="fab fa-facebook-f"></i>
            </a>
            <a href="https://www.instagram.com/requires0/" class="social-icon-link instagram" aria-label="Instagram" target="_blank" rel="noopener">
                <i class="fab fa-instagram"></i>
            </a>
            <a href="https://www.tiktok.com/@requires10" class="social-icon-link tiktok" aria-label="TikTok" target="_blank" rel="noopener">
                <i class="fab fa-tiktok"></i>
            </a>
            <a href="https://www.linkedin.com/in/requires0" class="social-icon-link linkedin" aria-label="LinkedIn" target="_blank" rel="noopener">
                <i class="fab fa-linkedin-in"></i>
            </a>
            <a href="https://x.com/Requires0" class="social-icon-link twitter" aria-label="Twitter" target="_blank" rel="noopener">
                <i class="fab fa-twitter"></i>
            </a>
            <a href="https://requires0.blogspot.com/" class="social-icon-link blogger" aria-label="Blogger" target="_blank" rel="noopener">
                <i class="fab fa-blogger-b"></i>
            </a>
            <a href="https://api.whatsapp.com/send?phone=01551053732" class="social-icon-link whatsapp" aria-label="WhatsApp" target="_blank" rel="noopener">
                <i class="fab fa-whatsapp"></i>
            </a>
        </div>
    </div>
</div>

<script>
    // Progress bar for scrolling
    window.addEventListener('scroll', function() {
        const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (scrollTop / scrollHeight) * 100;
        const progressBar = document.getElementById('progressBar');
        if (progressBar) { // Check if element exists
            progressBar.style.width = scrolled + '%';
        }
    });
    
    // Fade-in animation on scroll
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });
    
    // Observe elements for fade-in effect
    document.querySelectorAll('.article-header, .table-of-contents, .article-content > *:not(.decorative-divider), .contact-info').forEach((el) => {
        observer.observe(el);
    });
    
    // Smooth scroll for internal links
    document.querySelectorAll('.toc-list a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
</script>
</body>
</html>
    `;

    return (
        <div className={`min-h-screen ${darkMode ? 'bg-gray-900 text-gray-100' : 'bg-gray-100 text-gray-900'} font-sans p-4 sm:p-8 flex flex-col items-center justify-center transition-colors duration-300`}>
            {/* Font Imports */}
            <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800&display=swap" rel="stylesheet" />
            <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet" />
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css" />
            {/* Tailwind CSS */}
            <script src="https://cdn.tailwindcss.com"></script>

            {/* Global Styles for Animations */}
            <style>
                {`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideInUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes bounceIn {
                    0% { transform: scale(0.1); opacity: 0; }
                    60% { transform: scale(1.2); opacity: 1; }
                    100% { transform: scale(1); }
                }
                .animate-fadeIn { animation: fadeIn 0.8s ease-out forwards; }
                .animate-slideInUp { animation: slideInUp 0.6s ease-out forwards; }
                .animate-bounceIn { animation: bounceIn 0.7s ease-out forwards; }
                .delay-100 { animation-delay: 0.1s; }
                .delay-200 { animation-delay: 0.2s; }
                .delay-300 { animation-delay: 0.3s; }
                .delay-400 { animation-delay: 0.4s; }
                .delay-500 { animation-delay: 0.5s; }
                `}
            </style>

            {/* Dark Mode Toggle */}
            <button
                onClick={() => setDarkMode(!darkMode)}
                className={`fixed top-4 left-4 p-3 rounded-full shadow-lg transition-all duration-300 z-50 ${darkMode ? 'bg-gray-700 text-yellow-300 hover:bg-gray-600' : 'bg-yellow-300 text-gray-800 hover:bg-yellow-400'}`}
                aria-label="Toggle dark mode"
            >
                {darkMode ? <i className="fas fa-sun"></i> : <i className="fas fa-moon"></i>}
            </button>

            {/* Developer Logo - Fixed on all pages except Splash and API Key Input */}
            {(stage !== 'splash_screen' && stage !== 'api_key_input') && (
                <img
                    src="https://i.ibb.co/xKH7Rbby/ahmed-elsherbini-logo.png"
                    alt="Ahmad ElSherbiny Logo"
                    className="fixed top-4 right-4 w-10 h-10 sm:w-12 sm:h-12 z-40 transition-all duration-300 rounded-full shadow-md" // Adjusted size
                />
            )}

            {/* "اتصل بنا" Button - Fixed on all pages except Splash */}
            {stage !== 'splash_screen' && (
                <button
                    onClick={() => setShowContactModal(true)}
                    className="fixed bottom-4 left-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-full shadow-lg transform transition duration-300 ease-in-out hover:scale-105 z-40"
                    style={{ fontFamily: 'Tajawal' }}
                >
                    اتصل بنا
                </button>
            )}

            {/* Main Container */}
            <div className={`bg-white shadow-lg rounded-2xl p-6 sm:p-10 w-full max-w-4xl text-center transition-colors duration-300 ${darkMode ? 'dark:bg-gray-800' : ''}`}>
                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 transition-all duration-300" role="alert">
                        <strong className="font-bold">خطأ!</strong>
                        <span className="block sm:inline"> {error}</span>
                    </div>
                )}

                {/* Global Loading Indicator (if no specific button is processing) */}
                {loading && !processingButton && (
                    <div className="flex justify-center items-center mb-6 transition-all duration-300">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
                        <p className="mr-4 text-purple-600 font-semibold" style={{ fontFamily: 'Tajawal' }}>
                            جاري المعالجة...
                        </p>
                    </div>
                )}

                {/* Stage: Splash Screen */}
                {stage === 'splash_screen' && (
                    <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fadeIn">
                        <img src="https://i.ibb.co/xKH7Rbby/ahmed-elsherbini-logo.png" alt="Ahmad ElSherbiny Logo" className="w-32 h-32 mb-6 animate-bounceIn" />
                        <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600 mb-2 animate-slideInUp delay-100" style={{ fontFamily: 'Poppins' }}>
                            Requires for Academic Services
                        </h1>
                        <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600 mb-4 animate-slideInUp delay-200" style={{ fontFamily: 'Tajawal' }}>
                            ريكويرز للخدمات الأكاديمية
                        </h1>
                        <p className={`text-xl sm:text-2xl font-semibold mb-8 animate-fadeIn delay-300 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`} style={{ fontFamily: 'Tajawal' }}>
                            مركز إدارة المحتوى لمنصات ريكويرز
                        </p>
                        <p className={`text-sm sm:text-base mb-10 animate-fadeIn delay-400 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} style={{ fontFamily: 'Poppins' }}>
                            Prepared and designed with Faib coding by: <span className="font-bold text-purple-500">Ahmad ElSherbiny</span>
                        </p>
                        <button
                            onClick={() => setStage('api_key_input')}
                            className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-bold py-3 px-10 rounded-full shadow-lg transform transition duration-300 ease-in-out hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 animate-bounce delay-500"
                            style={{ fontFamily: 'Tajawal' }}
                        >
                            ابدأ
                        </button>
                    </div>
                )}

                {/* Stage: API Key Input (Gemini) */}
                {stage === 'api_key_input' && (
                    <div className="flex flex-col items-center transition-all duration-300 animate-fadeIn">
                        <h2 className={`text-2xl font-bold mb-6 transition-colors duration-300 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`} style={{ fontFamily: 'Tajawal' }}>
                            أدخل مفتاح الـ API الخاص بـ Gemini
                        </h2>
                        <p className={`mb-4 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} style={{ fontFamily: 'Tajawal' }}>
                            للاستفادة الكاملة من ميزات الذكاء الاصطناعي، يرجى إدخال مفتاح الـ API الخاص بك.
                            يمكنك الحصول على مفتاح مجاني من Google AI Studio.
                        </p>
                        <input
                            type="password"
                            placeholder="أدخل مفتاح الـ API هنا"
                            value={userApiKey}
                            onChange={(e) => setUserApiKey(e.target.value)}
                            className={`w-full max-w-md p-3 mb-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors duration-300 ${darkMode ? 'bg-gray-700 text-gray-200 border-gray-600' : 'bg-white text-gray-800 border-gray-300'}`}
                            style={{ fontFamily: 'Poppins' }}
                        />
                        <button
                            onClick={handleApiKeySubmit}
                            disabled={loading}
                            className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transform transition duration-300 ease-in-out hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50"
                            style={{ fontFamily: 'Tajawal' }}
                        >
                            بدء الاستخدام
                        </button>
                        <button
                            onClick={goToPreviousStage}
                            disabled={loading}
                            className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-full shadow-md transition duration-300 ease-in-out hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50 mt-4"
                            style={{ fontFamily: 'Tajawal' }}
                        >
                            رجوع
                        </button>
                    </div>
                )}


                {/* Stage: Ideas Generation (after API key is set) */}
                {stage === 'ideas_generation' && userApiKey && (
                    <button
                        onClick={() => generateIdeas()}
                        disabled={loading}
                        className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transform transition duration-300 ease-in-out hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 animate-fadeIn"
                        style={{ fontFamily: 'Tajawal' }}
                    >
                        فكرلي بأفكار جديدة!
                    </button>
                )}

                {/* Stage: Idea Selection */}
                {stage === 'idea_selection' && (
                    <div className="mt-8 transition-all duration-300 animate-fadeIn">
                        <h2 className={`text-2xl font-bold mb-6 transition-colors duration-300 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`} style={{ fontFamily: 'Tajawal' }}>اختر فكرة المحتوى ليومك:</h2>
                        
                        {/* Idea Customization Input */}
                        <div className={`mb-6 p-4 border rounded-lg shadow-inner transition-colors duration-300 ${darkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-gray-50'}`}>
                            <h3 className={`text-xl font-semibold mb-3 transition-colors duration-300 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`} style={{ fontFamily: 'Tajawal' }}>تخصيص الأفكار المقترحة:</h3>
                            <textarea
                                placeholder="أدخل تعليمات التخصيص هنا (مثال: أفكار عن التحديات الأكاديمية، أفكار أقصر)"
                                value={ideaCustomizationInput}
                                onChange={(e) => setIdeaCustomizationInput(e.target.value)}
                                className={`w-full p-2 mb-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors duration-300 ${darkMode ? 'bg-gray-800 text-gray-200 border-gray-600' : 'bg-white text-gray-800 border-gray-300'}`}
                                dir="rtl"
                                style={{ fontFamily: 'Tajawal' }}
                            ></textarea>
                            <button
                                onClick={() => generateIdeas(ideaCustomizationInput)}
                                disabled={loading || !ideaCustomizationInput.trim()}
                                className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-6 rounded-full shadow-md transition duration-300 ease-in-out hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50"
                                style={{ fontFamily: 'Tajawal' }}
                            >
                                {processingButton === 'generate_ideas' ? (
                                    <i className="fas fa-spinner fa-spin ml-2"></i>
                                ) : (
                                    'تخصيص الفكرة'
                                )}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {ideas.map((idea, index) => (
                                <div key={index} className="flex flex-col">
                                    <button
                                        onClick={() => { setSelectedIdea(idea); setStage('content_generation'); }}
                                        className={`p-5 rounded-xl shadow-md hover:shadow-lg transform transition duration-300 ease-in-out hover:scale-105 text-lg font-semibold text-right flex items-center justify-between flex-grow mb-2 ${darkMode ? 'bg-purple-900 border-purple-700 text-purple-200' : 'bg-purple-100 border-purple-300 text-purple-800'}`}
                                        style={{ fontFamily: 'Tajawal' }}
                                    >
                                        <span>{idea}</span>
                                        <i className={`fas fa-arrow-left ml-2 transition-colors duration-300 ${darkMode ? 'text-purple-400' : 'text-purple-600'}`}></i>
                                    </button>
                                    <div className="flex justify-end gap-2">
                                        <button
                                            onClick={() => translateText(idea, `idea-${index}`)}
                                            className={`py-1 px-3 rounded-full text-sm transition duration-200 ease-in-out ${darkMode ? 'bg-gray-600 hover:bg-gray-500 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`}
                                            disabled={loading}
                                            style={{ fontFamily: 'Tajawal' }}
                                        >
                                            {processingButton === `translate-idea-${index}` ? (
                                                <i className="fas fa-spinner fa-spin ml-2"></i>
                                            ) : (
                                                'ترجمة'
                                            )}
                                        </button>
                                        {translatedTexts[`idea-${index}`] && (
                                            <span className={`text-sm mt-1 transition-colors duration-300 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} dir="ltr" style={{ fontFamily: 'Poppins' }}>{translatedTexts[`idea-${index}`]}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-8 flex justify-center gap-4">
                            <button
                                onClick={() => generateIdeas()}
                                disabled={loading}
                                className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-6 rounded-full shadow-md transition duration-300 ease-in-out hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
                                style={{ fontFamily: 'Tajawal' }}
                            >
                                {processingButton === 'generate_ideas' ? (
                                    <i className="fas fa-spinner fa-spin ml-2"></i>
                                ) : (
                                    'أفكار تانية'
                                )}
                            </button>
                            <button
                                onClick={goToPreviousStage}
                                disabled={loading}
                                className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-full shadow-md transition duration-300 ease-in-out hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50"
                                style={{ fontFamily: 'Tajawal' }}
                            >
                                رجوع
                            </button>
                            <button
                                onClick={refreshCurrentStage}
                                disabled={loading}
                                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-6 rounded-full shadow-md transition duration-300 ease-in-out hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                                style={{ fontFamily: 'Tajawal' }}
                            >
                                {processingButton === 'refresh_current_stage' ? (
                                    <i className="fas fa-spinner fa-spin ml-2"></i>
                                ) : (
                                    'تحديث'
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Stage: Content Generation (Dynamic) */}
                {stage === 'content_generation' && selectedIdea && (
                    <div className="mt-8 text-right transition-all duration-300 animate-fadeIn">
                        <h2 className={`text-2xl font-bold mb-6 transition-colors duration-300 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`} style={{ fontFamily: 'Tajawal' }}>
                            توليد المحتوى لفكرة: <span className="text-purple-600">{selectedIdea}</span>
                        </h2>
                        <p className={`mb-6 transition-colors duration-300 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`} style={{ fontFamily: 'Tajawal' }}>
                            اختر المنصات التي تود توليد المحتوى لها، أو قم بتوليد كل المحتوى دفعة واحدة.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                            {platforms.filter(p => p.type === 'post').map(platform => (
                                <button
                                    key={platform.name}
                                    onClick={() => generateSpecificContent('post', platform.name)}
                                    disabled={loading}
                                    className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-full shadow-md transform transition duration-300 ease-in-out hover:scale-105 flex items-center justify-center gap-2"
                                    style={{ background: platform.color.startsWith('linear-gradient') ? platform.color : `linear-gradient(to right, ${platform.color}, ${platform.color}CC)`, fontFamily: 'Tajawal' }}
                                >
                                    <i className={`${platform.icon} text-xl`}></i>
                                    <span>توليد منشور {platform.name}</span>
                                </button>
                            ))}
                            {platforms.filter(p => p.type === 'message').map(platform => (
                                <button
                                    key={platform.name}
                                    onClick={() => {
                                        setWhatsappGmailPlatform(platform.name);
                                        setWhatsappGmailInput(''); // Clear input
                                        setWhatsappGmailResponse(''); // Clear response
                                        setCustomInstructions({}); // Clear custom instructions for modal
                                        setShowWhatsappGmailModal(true);
                                    }}
                                    disabled={loading}
                                    className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-full shadow-md transform transition duration-300 ease-in-out hover:scale-105 flex items-center justify-center gap-2"
                                    style={{ background: platform.color.startsWith('linear-gradient') ? platform.color : `linear-gradient(to right, ${platform.color}, ${platform.color}CC)`, fontFamily: 'Tajawal' }}
                                >
                                    <i className={`${platform.icon} text-xl`}></i>
                                    <span>توليد رد {platform.name}</span>
                                </button>
                            ))}
                            <button
                                onClick={() => generateSpecificContent('bloggerArticle')}
                                disabled={loading}
                                className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-full shadow-md transform transition duration-300 ease-in-out hover:scale-105 flex items-center justify-center gap-2"
                                style={{ fontFamily: 'Tajawal' }}
                            >
                                <i className="fab fa-blogger-b text-xl"></i>
                                <span>توليد مقال بلوجر</span>
                            </button>
                            <button
                                onClick={() => generateSpecificContent('imagePrompts')}
                                disabled={loading}
                                className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3 px-6 rounded-full shadow-md transform transition duration-300 ease-in-out hover:scale-105 flex items-center justify-center gap-2"
                                style={{ fontFamily: 'Tajawal' }}
                            >
                                <i className="fas fa-image text-xl"></i>
                                <span>توليد أوامر الصور</span>
                            </button>
                            <button
                                onClick={() => generateSpecificContent('videoPrompts')} // New video prompts button
                                disabled={loading}
                                className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-full shadow-md transform transition duration-300 ease-in-out hover:scale-105 flex items-center justify-center gap-2"
                                style={{ fontFamily: 'Tajawal' }}
                            >
                                <i className="fas fa-video text-xl"></i>
                                <span>توليد أوامر الفيديو</span>
                            </button>
                            <button
                                onClick={() => generateSpecificContent('carouselSlides', carouselSlideCount)} // New carousel button
                                disabled={loading}
                                className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 px-6 rounded-full shadow-md transform transition duration-300 ease-in-out hover:scale-105 flex items-center justify-center gap-2"
                                style={{ fontFamily: 'Tajawal' }}
                            >
                                <i className="fas fa-images text-xl"></i>
                                <span>توليد كاروسيل</span>
                            </button>
                            <div className="col-span-full flex justify-center items-center mt-2">
                                <label htmlFor="carousel-count" className={`text-lg ml-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`} style={{ fontFamily: 'Tajawal' }}>عدد الشرائح:</label>
                                <input
                                    type="number"
                                    id="carousel-count"
                                    min="2"
                                    max="10"
                                    value={carouselSlideCount}
                                    onChange={(e) => setCarouselSlideCount(parseInt(e.target.value))}
                                    className={`w-20 p-2 border rounded-lg text-center transition-colors duration-300 ${darkMode ? 'bg-gray-700 text-gray-200 border-gray-600' : 'bg-white text-gray-800 border-gray-300'}`}
                                    style={{ fontFamily: 'Poppins' }}
                                />
                            </div>
                        </div>

                        <button
                            onClick={() => generateAllContent(selectedIdea)}
                            disabled={loading}
                            className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transform transition duration-300 ease-in-out hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 mt-4"
                            style={{ fontFamily: 'Tajawal' }}
                        >
                            {processingButton === 'generate_all' ? (
                                <i className="fas fa-spinner fa-spin ml-2"></i>
                            ) : (
                                'توليد كل المحتوى (منشورات، مقال، صور، فيديو، كاروسيل)'
                            )}
                        </button>

                        <div className="mt-8 flex justify-center gap-4">
                            <button
                                onClick={goToPreviousStage}
                                disabled={loading}
                                className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-full shadow-md transition duration-300 ease-in-out hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50"
                                style={{ fontFamily: 'Tajawal' }}
                            >
                                رجوع
                            </button>
                            <button
                                onClick={refreshCurrentStage}
                                disabled={loading}
                                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-6 rounded-full shadow-md transition duration-300 ease-in-out hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                                style={{ fontFamily: 'Tajawal' }}
                            >
                                {processingButton === 'refresh_current_stage' ? (
                                    <i className="fas fa-spinner fa-spin ml-2"></i>
                                ) : (
                                    'تحديث'
                                )}
                            </button>
                            <button
                                onClick={goToNextStage}
                                disabled={loading}
                                className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-6 rounded-full shadow-md transform transition duration-300 ease-in-out hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
                                style={{ fontFamily: 'Tajawal' }}
                            >
                                التالي
                            </button>
                        </div>
                    </div>
                )}

                {/* Stage: Display Content */}
                {stage === 'display_content' && generatedContent && (
                    <div className="mt-8 text-right transition-all duration-300 animate-fadeIn">
                        <h2 className={`text-2xl font-bold mb-6 transition-colors duration-300 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`} style={{ fontFamily: 'Tajawal' }}>
                            المحتوى الجاهز لفكرة: <span className="text-purple-600">{selectedIdea}</span>
                        </h2>

                        {/* Social Media Posts */}
                        <div className="mb-10">
                            <h3 className={`text-xl font-semibold mb-4 border-b pb-2 transition-colors duration-300 ${darkMode ? 'text-gray-300 border-gray-700' : 'text-gray-700 border-gray-200'}`} style={{ fontFamily: 'Tajawal' }}>
                                منشورات وسائل التواصل الاجتماعي
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {platforms.filter(p => p.type === 'post').map(platform => {
                                    const postData = generatedContent.posts[platform.name] || {};
                                    const originalContent = postData.original;
                                    if (!originalContent) return null; // Only render if original content exists
                                    return (
                                        <div key={platform.name} className={`p-5 rounded-xl shadow-md border flex flex-col transition-colors duration-300 ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                                            <div className="flex items-center mb-3">
                                                <i className={`${platform.icon} text-2xl ml-3 transition-colors duration-300 ${darkMode ? 'text-purple-400' : 'text-purple-600'}`}></i>
                                                <h4 className={`text-lg font-bold transition-colors duration-300 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`} style={{ fontFamily: 'Tajawal' }}>{platform.name} (الأصلي)</h4>
                                            </div>
                                            <p className={`text-base mb-4 flex-grow whitespace-pre-wrap transition-colors duration-300 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`} dir="rtl" style={{ fontFamily: 'Tajawal' }}>{originalContent}</p>
                                            
                                            <div className="flex flex-col gap-2 mt-auto pt-4 border-t transition-colors duration-300" style={{borderColor: darkMode ? '#4A5568' : '#E2E8F0'}}>
                                                <div className="flex justify-start gap-2 flex-wrap">
                                                    <button
                                                        onClick={() => copyToClipboard(originalContent)}
                                                        className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-full transition duration-200 ease-in-out"
                                                        style={{ fontFamily: 'Tajawal' }}
                                                    >
                                                        نسخ
                                                    </button>
                                                    <button
                                                        onClick={() => regeneratePost(platform.name, originalContent)}
                                                        className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded-full transition duration-200 ease-in-out"
                                                        disabled={loading}
                                                        style={{ fontFamily: 'Tajawal' }}
                                                    >
                                                        {processingButton === `rephrase-${platform.name}` ? (
                                                            <i className="fas fa-spinner fa-spin ml-2"></i>
                                                        ) : (
                                                            'صياغة تانية'
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => translateText(originalContent, `post-${platform.name}-original`, 'post', platform.name)}
                                                        className={`py-2 px-4 rounded-full text-sm transition duration-200 ease-in-out ${darkMode ? 'bg-gray-600 hover:bg-gray-500 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`}
                                                        disabled={loading}
                                                        style={{ fontFamily: 'Tajawal' }}
                                                    >
                                                        {processingButton === `translate-post-${platform.name}-original` ? (
                                                            <i className="fas fa-spinner fa-spin ml-2"></i>
                                                        ) : (
                                                            'ترجمة'
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => optimizePostForSEO(platform.name, originalContent)}
                                                        className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-full text-sm transition duration-200 ease-in-out"
                                                        disabled={loading}
                                                        style={{ fontFamily: 'Tajawal' }}
                                                    >
                                                        {processingButton === `seo-${platform.name}` ? (
                                                            <i className="fas fa-spinner fa-spin ml-2"></i>
                                                        ) : (
                                                            'تحسين للسيو'
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => generateMarketingPost(platform.name, originalContent)}
                                                        className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded-full text-sm transition duration-200 ease-in-out"
                                                        disabled={loading}
                                                        style={{ fontFamily: 'Tajawal' }}
                                                    >
                                                        {processingButton === `marketing-${platform.name}` ? (
                                                            <i className="fas fa-spinner fa-spin ml-2"></i>
                                                        ) : (
                                                            'تسويق لريكويرز'
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => generateHashtagsKeywords(platform.name, originalContent)}
                                                        className="bg-teal-500 hover:bg-teal-600 text-white font-bold py-2 px-4 rounded-full text-sm transition duration-200 ease-in-out"
                                                        disabled={loading}
                                                        style={{ fontFamily: 'Tajawal' }}
                                                    >
                                                        {processingButton === `hashtags-${platform.name}` ? (
                                                            <i className="fas fa-spinner fa-spin ml-2"></i>
                                                        ) : (
                                                            'هاشتاغات/كلمات مفتاحية'
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => providePerformanceTips(platform.name, originalContent)}
                                                        className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-full text-sm transition duration-200 ease-in-out"
                                                        disabled={loading}
                                                        style={{ fontFamily: 'Tajawal' }}
                                                    >
                                                        {processingButton === `tips-${platform.name}` ? (
                                                            <i className="fas fa-spinner fa-spin ml-2"></i>
                                                        ) : (
                                                            'نصائح للأداء'
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => shareContent(platform.name, originalContent, platform.url)}
                                                        className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded-full text-sm transition duration-200 ease-in-out"
                                                        style={{ fontFamily: 'Tajawal' }}
                                                    >
                                                        مشاركة
                                                    </button>
                                                </div>
                                                <div className="flex flex-col gap-2 mt-2">
                                                    <textarea
                                                        placeholder="أدخل تعليمات التخصيص هنا (مثال: اجعلها أقصر، أضف دعوة لاتخاذ إجراء)"
                                                        value={customInstructions[platform.name] || ''}
                                                        onChange={(e) => setCustomInstructions(prev => ({ ...prev, [platform.name]: e.target.value }))}
                                                        className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors duration-300 ${darkMode ? 'bg-gray-800 text-gray-200 border-gray-600' : 'bg-white text-gray-800 border-gray-300'}`}
                                                        dir="rtl"
                                                        style={{ fontFamily: 'Tajawal' }}
                                                    ></textarea>
                                                    <button
                                                        onClick={() => customizeContent('post', platform.name, originalContent, customInstructions[platform.name] || '')}
                                                        className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded-full transition duration-200 ease-in-out"
                                                        disabled={loading || !customInstructions[platform.name]?.trim()}
                                                        style={{ fontFamily: 'Tajawal' }}
                                                    >
                                                        {processingButton === `customize-${platform.name}` ? (
                                                            <i className="fas fa-spinner fa-spin ml-2"></i>
                                                        ) : (
                                                            'تخصيص'
                                                        )}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Display Translated Post */}
                                            {postData.translated && (
                                                <div className={`mt-4 p-4 rounded-lg border transition-colors duration-300 ${darkMode ? 'bg-gray-600 border-gray-500' : 'bg-blue-50 border-blue-200'}`}>
                                                    <h5 className={`text-md font-bold mb-2 ${darkMode ? 'text-gray-100' : 'text-blue-800'}`} style={{ fontFamily: 'Tajawal' }}>ترجمة البوست:</h5>
                                                    <p className={`text-base whitespace-pre-wrap ${darkMode ? 'text-gray-200' : 'text-blue-900'}`} dir="ltr" style={{ fontFamily: 'Poppins' }}>{postData.translated}</p>
                                                    <button
                                                        onClick={() => copyToClipboard(postData.translated)}
                                                        className="mt-2 bg-blue-700 hover:bg-blue-800 text-white font-bold py-1 px-3 rounded-full text-sm"
                                                        style={{ fontFamily: 'Tajawal' }}
                                                    >
                                                        نسخ الترجمة
                                                    </button>
                                                </div>
                                            )}

                                            {/* Display Rephrased Post */}
                                            {postData.rephrased && (
                                                <div className={`mt-4 p-4 rounded-lg border transition-colors duration-300 ${darkMode ? 'bg-gray-600 border-gray-500' : 'bg-yellow-50 border-yellow-200'}`}>
                                                    <h5 className={`text-md font-bold mb-2 ${darkMode ? 'text-gray-100' : 'text-yellow-800'}`} style={{ fontFamily: 'Tajawal' }}>صياغة بديلة:</h5>
                                                    <p className={`text-base whitespace-pre-wrap ${darkMode ? 'text-gray-200' : 'text-yellow-900'}`} dir="rtl" style={{ fontFamily: 'Tajawal' }}>{postData.rephrased}</p>
                                                    <button
                                                        onClick={() => copyToClipboard(postData.rephrased)}
                                                        className="mt-2 bg-yellow-700 hover:bg-yellow-800 text-white font-bold py-1 px-3 rounded-full text-sm"
                                                        style={{ fontFamily: 'Tajawal' }}
                                                    >
                                                        نسخ الصياغة
                                                    </button>
                                                </div>
                                            )}

                                            {/* Display SEO Optimized Post */}
                                            {postData.seoOptimized && (
                                                <div className={`mt-4 p-4 rounded-lg border transition-colors duration-300 ${darkMode ? 'bg-gray-600 border-gray-500' : 'bg-green-50 border-green-200'}`}>
                                                    <h5 className={`text-md font-bold mb-2 ${darkMode ? 'text-gray-100' : 'text-green-800'}`} style={{ fontFamily: 'Tajawal' }}>بوست محسّن للسيو:</h5>
                                                    <p className={`text-base whitespace-pre-wrap ${darkMode ? 'text-gray-200' : 'text-green-900'}`} dir="rtl" style={{ fontFamily: 'Tajawal' }}>{postData.seoOptimized}</p>
                                                    <button
                                                        onClick={() => copyToClipboard(postData.seoOptimized)}
                                                        className="mt-2 bg-green-700 hover:bg-green-800 text-white font-bold py-1 px-3 rounded-full text-sm"
                                                        style={{ fontFamily: 'Tajawal' }}
                                                    >
                                                        نسخ بوست السيو
                                                    </button>
                                                </div>
                                            )}

                                            {/* Display Marketing Post */}
                                            {postData.marketing && (
                                                <div className={`mt-4 p-4 rounded-lg border transition-colors duration-300 ${darkMode ? 'bg-gray-600 border-gray-500' : 'bg-purple-50 border-purple-200'}`}>
                                                    <h5 className={`text-md font-bold mb-2 ${darkMode ? 'text-gray-100' : 'text-purple-800'}`} style={{ fontFamily: 'Tajawal' }}>بوست تسويقي لريكويرز:</h5>
                                                    <p className={`text-base whitespace-pre-wrap ${darkMode ? 'text-gray-200' : 'text-purple-900'}`} dir="rtl" style={{ fontFamily: 'Tajawal' }}>{postData.marketing}</p>
                                                    <button
                                                        onClick={() => copyToClipboard(postData.marketing)}
                                                        className="mt-2 bg-purple-700 hover:bg-purple-800 text-white font-bold py-1 px-3 rounded-full text-sm"
                                                        style={{ fontFamily: 'Tajawal' }}
                                                    >
                                                        نسخ البوست التسويقي
                                                    </button>
                                                </div>
                                            )}

                                            {/* Display Customized Post */}
                                            {postData.customized && (
                                                <div className={`mt-4 p-4 rounded-lg border transition-colors duration-300 ${darkMode ? 'bg-gray-600 border-gray-500' : 'bg-indigo-50 border-indigo-200'}`}>
                                                    <h5 className={`text-md font-bold mb-2 ${darkMode ? 'text-gray-100' : 'text-indigo-800'}`} style={{ fontFamily: 'Tajawal' }}>بوست مخصص:</h5>
                                                    <p className={`text-base whitespace-pre-wrap ${darkMode ? 'text-gray-200' : 'text-indigo-900'}`} dir="rtl" style={{ fontFamily: 'Tajawal' }}>{postData.customized}</p>
                                                    <button
                                                        onClick={() => copyToClipboard(postData.customized)}
                                                        className="mt-2 bg-indigo-700 hover:bg-indigo-800 text-white font-bold py-1 px-3 rounded-full text-sm"
                                                        style={{ fontFamily: 'Tajawal' }}
                                                    >
                                                        نسخ البوست المخصص
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Blogger Article */}
                        {generatedContent.bloggerArticle && (
                            <div className="mb-10">
                                <h3 className={`text-xl font-semibold mb-4 border-b pb-2 transition-colors duration-300 ${darkMode ? 'text-gray-300 border-gray-700' : 'text-gray-700 border-gray-200'}`} style={{ fontFamily: 'Tajawal' }}>
                                    مقال بلوجر الاحترافي (HTML/XML)
                                </h3>
                                <div className={`p-5 rounded-xl shadow-md border transition-colors duration-300 ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                                    <textarea
                                        readOnly
                                        value={getBloggerFullHtml(generatedContent.bloggerArticle, selectedIdea)}
                                        className={`w-full h-96 p-4 rounded-lg font-mono text-sm resize-y transition-colors duration-300 ${darkMode ? 'bg-gray-800 text-gray-200' : 'bg-gray-100 text-gray-800'}`}
                                        dir="ltr" // Force LTR for code display
                                        style={{ fontFamily: 'Poppins' }}
                                    ></textarea>
                                    <div className="flex justify-start gap-2 mt-4 flex-wrap">
                                        <button
                                            onClick={() => copyToClipboard(getBloggerFullHtml(generatedContent.bloggerArticle, selectedIdea))}
                                            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-full transition duration-200 ease-in-out"
                                            style={{ fontFamily: 'Tajawal' }}
                                        >
                                            نسخ المقال كاملاً
                                        </button>
                                        <button
                                            onClick={() => translateText(generatedContent.bloggerArticle, 'blogger-article')}
                                            className={`py-2 px-4 rounded-full text-sm transition duration-200 ease-in-out ${darkMode ? 'bg-gray-600 hover:bg-gray-500 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`}
                                            disabled={loading}
                                            style={{ fontFamily: 'Tajawal' }}
                                        >
                                            {processingButton === 'translate-blogger-article' ? (
                                                <i className="fas fa-spinner fa-spin ml-2"></i>
                                            ) : (
                                                'ترجمة'
                                            )}
                                        </button>
                                    </div>
                                    {translatedTexts['blogger-article'] && (
                                        <p className={`text-sm mt-2 whitespace-pre-wrap text-left transition-colors duration-300 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} dir="ltr" style={{ fontFamily: 'Poppins' }}>{translatedTexts['blogger-article']}</p>
                                    )}
                                    <div className={`mt-4 text-sm transition-colors duration-300 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} style={{ fontFamily: 'Tajawal' }}>
                                        <p>ملاحظة: يمكنك لصق هذا الكود مباشرة في وضع HTML/XML لمحرر بلوجر.</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Image Prompts */}
                        {generatedContent.imagePrompts.length > 0 && (
                            <div className="mb-10">
                                <h3 className={`text-xl font-semibold mb-4 border-b pb-2 transition-colors duration-300 ${darkMode ? 'text-gray-300 border-gray-700' : 'text-gray-700 border-gray-200'}`} style={{ fontFamily: 'Tajawal' }}>
                                    أمر تصميم الصور بالذكاء الاصطناعي (Prompt)
                                </h3>
                                <div className={`p-5 rounded-xl shadow-md border transition-colors duration-300 ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'} text-left`}>
                                    {generatedContent.imagePrompts.map((prompt, index) => (
                                        <div key={index} className="mb-4 last:mb-0">
                                            <p className={`text-base font-mono break-words transition-colors duration-300 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`} dir="ltr" style={{ fontFamily: 'Poppins' }}>{prompt}</p>
                                            {translatedTexts[`image-prompt-${index}`] && (
                                                <p className={`text-sm mt-2 whitespace-pre-wrap transition-colors duration-300 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} dir="ltr" style={{ fontFamily: 'Poppins' }}>{translatedTexts[`image-prompt-${index}`]}</p>
                                            )}
                                            <div className="flex justify-start gap-2 mt-2 flex-wrap">
                                                <button
                                                    onClick={() => copyToClipboard(prompt)}
                                                    className="bg-green-500 hover:bg-green-600 text-white font-bold py-1 px-3 rounded-full text-sm transition duration-200 ease-in-out"
                                                    style={{ fontFamily: 'Tajawal' }}
                                                >
                                                    نسخ
                                                </button>
                                                <button
                                                    onClick={() => translateText(prompt, `image-prompt-${index}`)}
                                                    className={`py-1 px-3 rounded-full text-sm transition duration-200 ease-in-out ${darkMode ? 'bg-gray-600 hover:bg-gray-500 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`}
                                                    disabled={loading}
                                                    style={{ fontFamily: 'Tajawal' }}
                                                >
                                                    {processingButton === `translate-image-prompt-${index}` ? (
                                                        <i className="fas fa-spinner fa-spin ml-2"></i>
                                                    ) : (
                                                        'ترجمة'
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Video Prompts */}
                        {generatedContent.videoPrompts.length > 0 && (
                            <div className="mb-10">
                                <h3 className={`text-xl font-semibold mb-4 border-b pb-2 transition-colors duration-300 ${darkMode ? 'text-gray-300 border-gray-700' : 'text-gray-700 border-gray-200'}`} style={{ fontFamily: 'Tajawal' }}>
                                    أمر تصميم الفيديو بالذكاء الاصطناعي (Prompt)
                                </h3>
                                <div className={`p-5 rounded-xl shadow-md border transition-colors duration-300 ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'} text-left`}>
                                    {generatedContent.videoPrompts.map((prompt, index) => (
                                        <div key={index} className="mb-4 last:mb-0">
                                            <p className={`text-base font-mono break-words transition-colors duration-300 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`} dir="ltr" style={{ fontFamily: 'Poppins' }}>{prompt}</p>
                                            {translatedTexts[`video-prompt-${index}`] && (
                                                <p className={`text-sm mt-2 whitespace-pre-wrap transition-colors duration-300 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} dir="ltr" style={{ fontFamily: 'Poppins' }}>{translatedTexts[`video-prompt-${index}`]}</p>
                                            )}
                                            <div className="flex justify-start gap-2 mt-2 flex-wrap">
                                                <button
                                                    onClick={() => copyToClipboard(prompt)}
                                                    className="bg-green-500 hover:bg-green-600 text-white font-bold py-1 px-3 rounded-full text-sm transition duration-200 ease-in-out"
                                                    style={{ fontFamily: 'Tajawal' }}
                                                >
                                                    نسخ
                                                </button>
                                                <button
                                                    onClick={() => translateText(prompt, `video-prompt-${index}`)}
                                                    className={`py-1 px-3 rounded-full text-sm transition duration-200 ease-in-out ${darkMode ? 'bg-gray-600 hover:bg-gray-500 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`}
                                                    disabled={loading}
                                                    style={{ fontFamily: 'Tajawal' }}
                                                >
                                                    {processingButton === `translate-video-prompt-${index}` ? (
                                                        <i className="fas fa-spinner fa-spin ml-2"></i>
                                                    ) : (
                                                        'ترجمة'
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Carousel Slides */}
                        {generatedContent.carouselSlides.length > 0 && (
                            <div className="mb-10">
                                <h3 className={`text-xl font-semibold mb-4 border-b pb-2 transition-colors duration-300 ${darkMode ? 'text-gray-300 border-gray-700' : 'text-gray-700 border-gray-200'}`} style={{ fontFamily: 'Tajawal' }}>
                                    شرائح الكاروسيل
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {generatedContent.carouselSlides.map((slide, index) => (
                                        <div key={index} className={`p-5 rounded-xl shadow-md border flex flex-col transition-colors duration-300 ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                                            <h4 className={`text-lg font-bold mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`} style={{ fontFamily: 'Tajawal' }}>شريحة {index + 1}: {slide.title}</h4>
                                            <p className={`text-base mb-4 flex-grow whitespace-pre-wrap transition-colors duration-300 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`} dir="rtl" style={{ fontFamily: 'Tajawal' }}>{slide.description}</p>
                                            {translatedTexts[`carousel-slide-${index}`] && (
                                                <p className={`text-sm mt-2 whitespace-pre-wrap transition-colors duration-300 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} dir="ltr" style={{ fontFamily: 'Poppins' }}>{translatedTexts[`carousel-slide-${index}`]}</p>
                                            )}
                                            <div className="flex justify-start gap-2 mt-auto pt-4 border-t transition-colors duration-300" style={{borderColor: darkMode ? '#4A5568' : '#E2E8F0'}}>
                                                <button
                                                    onClick={() => copyToClipboard(`Slide ${index + 1}: ${slide.title}\n${slide.description}`)}
                                                    className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-full text-sm transition duration-200 ease-in-out"
                                                    style={{ fontFamily: 'Tajawal' }}
                                                >
                                                    نسخ الشريحة
                                                </button>
                                                <button
                                                    onClick={() => translateText(`Slide ${index + 1}: ${slide.title}\n${slide.description}`, `carousel-slide-${index}`)}
                                                    className={`py-2 px-4 rounded-full text-sm transition duration-200 ease-in-out ${darkMode ? 'bg-gray-600 hover:bg-gray-500 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`}
                                                    disabled={loading}
                                                    style={{ fontFamily: 'Tajawal' }}
                                                >
                                                    {processingButton === `translate-carousel-slide-${index}` ? (
                                                        <i className="fas fa-spinner fa-spin ml-2"></i>
                                                    ) : (
                                                        'ترجمة'
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Footer Platform Buttons for direct generation */}
                        <div className="mb-10 mt-8">
                            <h3 className={`text-xl font-semibold mb-4 border-b pb-2 transition-colors duration-300 ${darkMode ? 'text-gray-300 border-gray-700' : 'text-gray-700 border-gray-200'}`} style={{ fontFamily: 'Tajawal' }}>
                                توليد محتوى لمنصات أخرى (لنفس الفكرة)
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {platforms.filter(p => p.type === 'post').map(platform => (
                                    <button
                                        key={`footer-${platform.name}`}
                                        onClick={() => generateSpecificContent('post', platform.name)}
                                        disabled={loading}
                                        className="text-white font-bold py-3 px-6 rounded-full shadow-md transform transition duration-300 ease-in-out hover:scale-105 flex items-center justify-center gap-2"
                                        style={{ background: platform.color.startsWith('linear-gradient') ? platform.color : `linear-gradient(to right, ${platform.color}, ${platform.color}CC)`, fontFamily: 'Tajawal' }}
                                    >
                                        <i className={`${platform.icon} text-xl`}></i>
                                        <span>توليد {platform.name}</span>
                                    </button>
                                ))}
                                {platforms.filter(p => p.type === 'message').map(platform => (
                                    <button
                                        key={`footer-${platform.name}`}
                                        onClick={() => {
                                            setWhatsappGmailPlatform(platform.name);
                                            setWhatsappGmailInput(''); // Clear input
                                            setWhatsappGmailResponse(''); // Clear response
                                            setCustomInstructions({}); // Clear custom instructions for modal
                                            setShowWhatsappGmailModal(true);
                                        }}
                                        disabled={loading}
                                        className="text-white font-bold py-3 px-6 rounded-full shadow-md transform transition duration-300 ease-in-out hover:scale-105 flex items-center justify-center gap-2"
                                        style={{ background: platform.color.startsWith('linear-gradient') ? platform.color : `linear-gradient(to right, ${platform.color}, ${platform.color}CC)`, fontFamily: 'Tajawal' }}
                                    >
                                        <i className={`${platform.icon} text-xl`}></i>
                                        <span>رد {platform.name}</span>
                                    </button>
                                ))}
                                <button
                                    onClick={() => generateSpecificContent('bloggerArticle')}
                                    disabled={loading}
                                    className="text-white font-bold py-3 px-6 rounded-full shadow-md transform transition duration-300 ease-in-out hover:scale-105 flex items-center justify-center gap-2"
                                    style={{ background: `linear-gradient(to right, #ff5722, #ff5722CC)`, fontFamily: 'Tajawal' }}
                                >
                                    <i className="fab fa-blogger-b text-xl"></i>
                                    <span>توليد مقال بلوجر</span>
                                </button>
                                <button
                                    onClick={() => generateSpecificContent('imagePrompts')}
                                    disabled={loading}
                                    className="text-white font-bold py-3 px-6 rounded-full shadow-md transform transition duration-300 ease-in-out hover:scale-105 flex items-center justify-center gap-2"
                                    style={{ background: `linear-gradient(to right, #6366f1, #6366f1CC)`, fontFamily: 'Tajawal' }}
                                >
                                    <i className="fas fa-image text-xl"></i>
                                    <span>توليد أوامر الصور</span>
                                </button>
                                <button
                                    onClick={() => generateSpecificContent('videoPrompts')}
                                    disabled={loading}
                                    className="text-white font-bold py-3 px-6 rounded-full shadow-md transform transition duration-300 ease-in-out hover:scale-105 flex items-center justify-center gap-2"
                                    style={{ background: `linear-gradient(to right, #ff0000, #ff0000CC)`, fontFamily: 'Tajawal' }}
                                >
                                    <i className="fas fa-video text-xl"></i>
                                    <span>توليد أوامر الفيديو</span>
                                </button>
                                <button
                                    onClick={() => generateSpecificContent('carouselSlides', carouselSlideCount)}
                                    disabled={loading}
                                    className="text-white font-bold py-3 px-6 rounded-full shadow-md transform transition duration-300 ease-in-out hover:scale-105 flex items-center justify-center gap-2"
                                    style={{ background: `linear-gradient(to right, #f59e0b, #f59e0bCC)`, fontFamily: 'Tajawal' }}
                                >
                                    <i className="fas fa-images text-xl"></i>
                                    <span>توليد كاروسيل</span>
                                </button>
                            </div>
                        </div>


                        {/* Global Navigation Buttons */}
                        <div className="flex justify-center gap-4 mt-8">
                            <button
                                onClick={startNewDay}
                                className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transform transition duration-300 ease-in-out hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50"
                                style={{ fontFamily: 'Tajawal' }}
                            >
                                ابدأ يوم جديد!
                            </button>
                            <button
                                onClick={goBackToIdeaSelection}
                                className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-8 rounded-full shadow-lg transform transition duration-300 ease-in-out hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50"
                                style={{ fontFamily: 'Tajawal' }}
                            >
                                رجوع لاختيار الفكرة
                            </button>
                            <button
                                onClick={refreshCurrentStage}
                                disabled={loading}
                                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-6 rounded-full shadow-md transition duration-300 ease-in-out hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                                style={{ fontFamily: 'Tajawal' }}
                            >
                                {processingButton === 'refresh_current_stage' ? (
                                    <i className="fas fa-spinner fa-spin ml-2"></i>
                                ) : (
                                    'تحديث'
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Contact Modal */}
            {showContactModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fadeIn">
                    <div className={`p-8 rounded-lg shadow-xl w-11/12 md:w-2/3 lg:w-1/2 relative transition-colors duration-300 ${darkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-900'}`}>
                        <button
                            onClick={() => setShowContactModal(false)}
                            className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 text-2xl"
                        >
                            &times;
                        </button>
                        <h2 className={`text-2xl font-bold mb-6 text-center transition-colors duration-300 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`} style={{ fontFamily: 'Tajawal' }}>
                            تواصل معنا
                        </h2>
                        <div className="flex flex-wrap justify-center gap-6 text-right"> {/* Changed to flex wrap for icons */}
                            {contactInfo.map((item, index) => (
                                <a
                                    key={index}
                                    href={item.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`w-20 h-20 rounded-full flex flex-col items-center justify-center shadow-md transform transition duration-300 ease-in-out hover:scale-110 group`}
                                    style={{ background: item.color.startsWith('linear-gradient') ? item.color : `linear-gradient(to right, ${item.color}, ${item.color}CC)` }}
                                    title={item.label} // Tooltip for accessibility
                                >
                                    <i className={`${item.icon} text-3xl text-white group-hover:text-white transition-colors duration-300`}></i>
                                    {/* <p className="text-white text-xs mt-1" style={{ fontFamily: 'Tajawal' }}>{item.label}</p> */}
                                </a>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* WhatsApp/Gmail Response Modal */}
            {showWhatsappGmailModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fadeIn">
                    <div className={`p-8 rounded-lg shadow-xl w-11/12 md:w-2/3 lg:w-1/2 relative transition-colors duration-300 ${darkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-900'}`}>
                        <button
                            onClick={() => setShowWhatsappGmailModal(false)}
                            className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 text-2xl"
                        >
                            &times;
                        </button>
                        <h2 className={`text-2xl font-bold mb-6 text-center transition-colors duration-300 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`} style={{ fontFamily: 'Tajawal' }}>
                            توليد رد لـ {whatsappGmailPlatform}
                        </h2>
                        <textarea
                            placeholder={`أدخل رسالة العميل هنا لـ ${whatsappGmailPlatform}`}
                            value={whatsappGmailInput}
                            onChange={(e) => setWhatsappGmailInput(e.target.value)}
                            className={`w-full p-3 mb-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors duration-300 ${darkMode ? 'bg-gray-700 text-gray-200 border-gray-600' : 'bg-white text-gray-800 border-gray-300'}`}
                            dir="rtl"
                            rows="4"
                            style={{ fontFamily: 'Tajawal' }}
                        ></textarea>
                        <button
                            onClick={generateWhatsappGmailResponse}
                            disabled={loading || !whatsappGmailInput.trim()}
                            className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-6 rounded-full shadow-md transition duration-300 ease-in-out hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 mb-4"
                            style={{ fontFamily: 'Tajawal' }}
                        >
                            {processingButton === 'whatsapp_gmail_response' ? (
                                <i className="fas fa-spinner fa-spin ml-2"></i>
                            ) : (
                                'توليد الرد'
                            )}
                        </button>

                        {whatsappGmailResponse && (
                            <div className={`mt-6 p-4 rounded-lg border transition-colors duration-300 ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-200'}`}>
                                <h3 className={`text-xl font-semibold mb-3 transition-colors duration-300 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`} style={{ fontFamily: 'Tajawal' }}>الرد المقترح:</h3>
                                <p className={`text-base whitespace-pre-wrap transition-colors duration-300 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`} dir="rtl" style={{ fontFamily: 'Tajawal' }}>{whatsappGmailResponse}</p>
                                {translatedTexts[`message-response-${whatsappGmailPlatform}`] && (
                                    <p className={`text-sm mt-2 whitespace-pre-wrap transition-colors duration-300 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} dir="ltr" style={{ fontFamily: 'Poppins' }}>{translatedTexts[`message-response-${whatsappGmailPlatform}`]}</p>
                                )}
                                <div className="flex flex-col gap-2 mt-4 pt-4 border-t transition-colors duration-300" style={{borderColor: darkMode ? '#4A5568' : '#E2E8F0'}}>
                                    <div className="flex justify-start gap-2 flex-wrap">
                                        <button
                                            onClick={() => copyToClipboard(whatsappGmailResponse)}
                                            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-full transition duration-200 ease-in-out"
                                            style={{ fontFamily: 'Tajawal' }}
                                        >
                                            نسخ
                                        </button>
                                        <button
                                            onClick={() => translateText(whatsappGmailResponse, `message-response-${whatsappGmailPlatform}`)}
                                            className={`py-2 px-4 rounded-full text-sm transition duration-200 ease-in-out ${darkMode ? 'bg-gray-600 hover:bg-gray-500 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`}
                                            disabled={loading}
                                            style={{ fontFamily: 'Tajawal' }}
                                        >
                                            {processingButton === `translate-message-response-${whatsappGmailPlatform}` ? (
                                                <i className="fas fa-spinner fa-spin ml-2"></i>
                                            ) : (
                                                'ترجمة'
                                            )}
                                        </button>
                                    </div>
                                    <div className="flex flex-col gap-2 mt-2">
                                        <textarea
                                            placeholder="أدخل تعليمات التخصيص هنا (مثال: اجعل الرد أقصر، أضف تفاصيل معينة)"
                                            value={customInstructions[whatsappGmailPlatform] || ''}
                                            onChange={(e) => setCustomInstructions(prev => ({ ...prev, [whatsappGmailPlatform]: e.target.value }))}
                                            className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors duration-300 ${darkMode ? 'bg-gray-800 text-gray-200 border-gray-600' : 'bg-white text-gray-800 border-gray-300'}`}
                                            dir="rtl"
                                            style={{ fontFamily: 'Tajawal' }}
                                        ></textarea>
                                        <button
                                            onClick={() => customizeContent('message', whatsappGmailPlatform, whatsappGmailResponse, customInstructions[whatsappGmailPlatform] || '')}
                                            className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded-full transition duration-200 ease-in-out"
                                            disabled={loading || !customInstructions[whatsappGmailPlatform]?.trim()}
                                            style={{ fontFamily: 'Tajawal' }}
                                        >
                                            {processingButton === `customize-${whatsappGmailPlatform}` ? (
                                                <i className="fas fa-spinner fa-spin ml-2"></i>
                                            ) : (
                                                'تخصيص'
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;
