var menu = ['Slide 1', 'Slide 2', 'Slide 3']
var mySwiper = new Swiper ('.swiper-container', {
    navigation: {
      nextEl: '.swiper-button-next',
      prevEl: '.swiper-button-prev',
    },
  })

  const btn = document.getElementById("openSearchBtn");
  const searchBox = document.getElementById("searchBox");

  btn.addEventListener("click", () => {
    if (searchBox.classList.contains("open")) {
      searchBox.classList.remove("open");
      setTimeout(() => {
        if (!searchBox.classList.contains("open")) {
          searchBox.style.display = "none";
        }
      }, 300);
    } else {
      searchBox.style.display = "block";
      setTimeout(() => searchBox.classList.add("open"), 10);
    }
  });

  const menuBtn = document.getElementById("menuBtn");
  const menuOverlay = document.getElementById("menuOverlay");
  const accordionHeader = document.querySelector(".accordion-header");
  const accordionContent = document.querySelector(".accordion-content");

  menuBtn.addEventListener("click", () => {
    const isOpen = menuOverlay.classList.toggle("open");
    menuBtn.style.transform = isOpen ? "rotate(90deg)" : "rotate(0deg)";
  });

  menuOverlay.addEventListener("click", (e) => {
    if (e.target === menuOverlay) {
      menuOverlay.classList.remove("open");
      menuBtn.style.transform = "rotate(0deg)";
    }
  });

  accordionHeader.addEventListener("click", () => {
    const isOpen = accordionHeader.classList.toggle("active");
    accordionContent.style.maxHeight = isOpen ? accordionContent.scrollHeight + "px" : "0";
  });

