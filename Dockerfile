FROM node:20-alpine3.21

WORKDIR /app

COPY api-server.js ./api-server.js
COPY bmctl ./bmctl
COPY reports ./reports
COPY logs ./logs
COPY xbox-gamepad-bridge ./xbox-gamepad-bridge
COPY runtime ./runtime
COPY profiles ./profiles
COPY controller-doctor.sh ./controller-doctor.sh

RUN chmod +x /app/bmctl /app/controller-doctor.sh

EXPOSE 8787

CMD ["node", "api-server.js"]
