FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY backend/KinetixCart.csproj backend/
RUN dotnet restore backend/KinetixCart.csproj
COPY . .
RUN dotnet publish backend/KinetixCart.csproj --configuration Release --no-restore --output /out

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app/kinetix/backend
COPY --from=build /out/ ./
COPY --from=build /src/index.html /src/admin.html /src/timer.html /src/kinetix-style.css /src/kinetix-script.js /src/kinetix-admin.css /src/kinetix-admin.js /app/kinetix/
COPY --from=build /src/images/ /app/kinetix/images/
COPY --from=build /src/videos/ /app/kinetix/videos/
COPY --from=build /src/back.mp4 /app/kinetix/back.mp4
ENV ASPNETCORE_HTTP_PORTS=10000
EXPOSE 10000
CMD ["sh", "-c", "dotnet KinetixCart.dll --urls http://0.0.0.0:${PORT:-10000}"]
